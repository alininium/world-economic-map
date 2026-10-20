import { seriesFor, type SeriesTable } from '../../shared/indicators';
import type { DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { readCountryIds, writeDataset } from '../lib/write';
import { latestByCountry, type RawPoint } from './observations';

const API = 'https://api.worldbank.org/v2';
/** How far back to look for a country's latest value. */
const YEARS_BACK = 10;
const PER_PAGE = 1000;

interface WbRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

interface WbPageMeta {
  page: number;
  pages: number;
  lastupdated?: string;
}

/** Parses one page of the World Bank v2 JSON API: `[meta, rows]`, or `[{ message }]` on error. */
export function parseWbPage(body: string): { meta: WbPageMeta; points: RawPoint[] } {
  const json = JSON.parse(body) as unknown;
  if (!Array.isArray(json) || json.length < 1) throw new Error('Unexpected World Bank response');
  const head = json[0] as { message?: { value?: string }[] } & WbPageMeta;
  if (head.message) throw new Error(`World Bank API: ${head.message[0]?.value ?? 'error'}`);
  const rows = (json[1] ?? []) as WbRow[];
  return {
    meta: head,
    points: rows.map((r) => ({
      id: r.countryiso3code,
      year: Number(r.date),
      value: r.value,
    })),
  };
}

async function fetchIndicator(code: string, from: number, to: number) {
  const points: RawPoint[] = [];
  let lastUpdated: string | undefined;
  let retrievedAt = '';
  for (let page = 1, pages = 1; page <= pages; page++) {
    const url = `${API}/country/all/indicator/${encodeURIComponent(code)}?format=json&per_page=${PER_PAGE}&date=${from}:${to}&page=${page}`;
    const res = await cachedFetch(url);
    const parsed = parseWbPage(res.body);
    pages = parsed.meta.pages;
    lastUpdated = parsed.meta.lastupdated;
    retrievedAt = res.retrievedAt;
    points.push(...parsed.points);
  }
  return { points, lastUpdated, retrievedAt };
}

export async function runWorldBank(): Promise<void> {
  console.log('worldbank: World Development Indicators');
  const ids = await readCountryIds();
  const to = new Date().getUTCFullYear();
  const table: SeriesTable = {};
  const updated: string[] = [];
  let retrievedAt = '';
  for (const { code } of seriesFor('worldbank')) {
    console.log(`  ${code}`);
    const res = await fetchIndicator(code, to - YEARS_BACK, to);
    table[code] = latestByCountry(res.points, ids, to);
    if (res.lastUpdated) updated.push(`${code} ${res.lastUpdated}`);
    if (res.retrievedAt > retrievedAt) retrievedAt = res.retrievedAt;
  }
  const years = Object.values(table).flatMap((s) => Object.values(s).map((o) => o.year));
  const meta: DatasetMeta = {
    id: 'worldbank',
    title: 'World Bank World Development Indicators',
    source: 'World Bank, World Development Indicators (API v2)',
    sourceUrl: 'https://data.worldbank.org/',
    license: 'CC BY 4.0',
    retrievedAt,
    dataYear: years.length ? `${Math.min(...years)}–${Math.max(...years)}` : null,
    notes: `Latest available year per country within ${YEARS_BACK} years. Source last updated: ${updated.join('; ')}.`,
  };
  await writeDataset('macro/worldbank.json', meta, table);
}
