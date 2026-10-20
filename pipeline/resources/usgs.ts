import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COMMODITIES,
  RESOURCE_FILES,
  type Measure,
  type MeasureTable,
  type ResourceTable,
} from '../../shared/commodities';
import type { Observation } from '../../shared/indicators';
import type { Country, Dataset, DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { DATA_DIR, writeDataset } from '../lib/write';
import { parseCsv } from '../macro/currencies';
import { isAggregate, isWorldTotal, nameResolver } from './names';

/**
 * USGS Mineral Commodity Summaries world production and reserves data release. The default is
 * the MCS 2025 release (data year 2024); set USGS_MCS_URL to point at a newer world-data CSV.
 * DOI: https://doi.org/10.5066/P13XCP3R
 */
const DEFAULT_URL =
  'https://www.sciencebase.gov/catalog/file/get/6798fd34d34ea8c18376e8ee?name=MCS2025_World_Data.csv';

export interface UsgsColumns {
  commodity: string;
  country: string;
  type: string;
  unit: string | null;
  /** Production columns with the year each refers to, newest first. */
  production: { name: string; year: number }[];
  reserves: { name: string; year: number | null } | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');

/** Finds the columns by pattern; throws with the actual header when the layout is unexpected. */
export function detectColumns(header: readonly string[]): UsgsColumns {
  const find = (re: RegExp) => header.find((h) => re.test(norm(h)));
  const commodity = find(/^commodity$/);
  const country = find(/^country$/);
  const type = find(/^type$/);
  const unit = find(/unit/) ?? null;
  const production = header
    .map((name) => ({ name, m: /^prod[a-z_]*?(\d{4})/.exec(norm(name)) }))
    .filter((x) => x.m)
    .map((x) => ({ name: x.name, year: Number(x.m![1]) }))
    .sort((a, b) => b.year - a.year);
  const resName = find(/^reserves/);
  const reserves = resName
    ? { name: resName, year: /(\d{4})/.exec(resName) ? Number(/(\d{4})/.exec(resName)![1]) : null }
    : null;
  if (!commodity || !country || !type || !production.length) {
    throw new Error(
      `USGS world data has an unexpected header; update detectColumns. Header: ${header.join(' | ')}`,
    );
  }
  return { commodity, country, type, unit, production, reserves };
}

/** USGS cells hold numbers with separators, or codes like W (withheld), NA, —. Codes are missing. */
export function parseUsgsNumber(cell: string | undefined): number | null {
  if (!cell) return null;
  const cleaned = cell.replace(/[,\s]/g, '').replace(/^[<>~]/, '');
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

/** USGS flags some countries' rows of a series as estimated; they are still the same series. */
export const seriesKey = (type: string): string =>
  type
    .replace(/[\s,;]*\(?\b(estimated|estimate|est\.?)\)?\s*$/i, '')
    .trim()
    .toLowerCase();

export interface UsgsResult {
  table: ResourceTable;
  unmatched: string[];
  /** TYPE values that matched a measure but were not used because another series was. */
  skipped: string[];
}

/** Adds rows for one entity: same-year values add up (territories listed apart), else the newer wins. */
function merge(prev: Observation | undefined, next: Observation): Observation {
  if (!prev || next.year > prev.year) return next;
  if (next.year === prev.year) return { value: prev.value + next.value, year: prev.year };
  return prev;
}

export function usgsTable(
  rows: Record<string, string>[],
  resolve: (name: string) => string | null,
): UsgsResult {
  const header = rows[0] ? Object.keys(rows[0]) : [];
  const cols = detectColumns(header);
  const table: ResourceTable = {};
  const unmatched = new Set<string>();
  const skipped = new Set<string>();
  /** commodity:measure → the one series (TYPE without an "estimated" flag) used for it. */
  const chosenType = new Map<string, string>();

  const put = (
    cid: string,
    measure: Measure,
    unit: string,
    id: string | null,
    obs: Observation,
  ) => {
    const byMeasure = (table[cid] ??= {});
    const t: MeasureTable = (byMeasure[measure] ??= { unit, values: {} });
    if (id) t.values[id] = merge(t.values[id], obs);
    else t.world = merge(t.world, obs);
  };

  for (const def of COMMODITIES) {
    const ref = def.usgs;
    if (!ref) continue;
    for (const r of rows) {
      if (!ref.commodity.test((r[cols.commodity] ?? '').trim())) continue;
      const name = (r[cols.country] ?? '').trim();
      const world = isWorldTotal(name);
      const id = world || isAggregate(name) ? null : resolve(name);
      if (!world && !isAggregate(name) && !id) unmatched.add(name);
      if (!world && !id) continue;
      const type = (r[cols.type] ?? '').trim();
      const unit = (cols.unit && r[cols.unit]?.trim()) || 'as published';
      const measure: Measure | null = ref.mine?.test(type)
        ? 'production'
        : ref.refinery?.test(type)
          ? 'refining'
          : null;
      if (!measure) continue;
      const key = `${def.id}:${measure}`;
      const series = seriesKey(type);
      const chosen = chosenType.get(key) ?? series;
      if (chosen !== series) {
        skipped.add(`${def.label}: ${type}`);
        continue;
      }
      chosenType.set(key, series);
      for (const p of cols.production) {
        const v = parseUsgsNumber(r[p.name]);
        if (v !== null) {
          put(def.id, measure, unit, id, { value: v, year: p.year });
          break;
        }
      }
      if (ref.reserves && measure === 'production' && cols.reserves) {
        const v = parseUsgsNumber(r[cols.reserves.name]);
        const year = cols.reserves.year ?? cols.production[0]!.year;
        if (v !== null) put(def.id, 'reserves', unit, id, { value: v, year });
      }
    }
  }
  return { table, unmatched: [...unmatched].sort(), skipped: [...skipped].sort() };
}

export async function runUsgs(): Promise<void> {
  const url = process.env.USGS_MCS_URL || DEFAULT_URL;
  console.log(`usgs: Mineral Commodity Summaries world data (${url})`);
  const { body, retrievedAt } = await cachedFetch(url);
  const countries = JSON.parse(
    await readFile(path.join(DATA_DIR, 'countries.json'), 'utf8'),
  ) as Dataset<Country[]>;
  const { table, unmatched, skipped } = usgsTable(parseCsv(body), nameResolver(countries.data));
  if (skipped.length) console.log(`  other USGS series not used: ${skipped.join('; ')}`);
  if (unmatched.length) {
    console.warn(
      `  country names not matched (left out; add to pipeline/resources/names.ts): ${unmatched.join('; ')}`,
    );
  }
  const years = Object.values(table).flatMap((m) =>
    Object.values(m).flatMap((t) => Object.values(t?.values ?? {}).map((o) => o.year)),
  );
  const meta: DatasetMeta = {
    id: 'usgs',
    title: 'Mineral production and reserves',
    source: 'U.S. Geological Survey, Mineral Commodity Summaries data release',
    sourceUrl: 'https://doi.org/10.5066/P13XCP3R',
    license: 'Public domain (U.S. Government work)',
    retrievedAt,
    dataYear: years.length ? String(Math.max(...years)) : null,
    notes: `Mine and refinery production and reserves as published, in each commodity's USGS unit. Withheld (W) and unavailable values are missing.${unmatched.length ? ` Unmatched names: ${unmatched.join('; ')}.` : ''}`,
  };
  await writeDataset(RESOURCE_FILES.usgs, meta, table);
}
