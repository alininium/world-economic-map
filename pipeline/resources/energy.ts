import { COMMODITIES, RESOURCE_FILES, type ResourceTable } from '../../shared/commodities';
import type { DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { readCountryIds, writeDataset } from '../lib/write';
import { parseCsv } from '../macro/currencies';
import { latestByCountry } from '../macro/observations';

/**
 * Our World in Data's energy dataset republishes the Energy Institute Statistical Review per
 * country in one CSV. This is its legacy release, frozen at the 2025 Statistical Review.
 */
const URL = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';

/**
 * Values older than this many years before the world total's year are dropped: the file also
 * carries an older secondary series (The Shift Data Portal, to 2016) that is not the
 * Statistical Review and would be presented as current.
 */
const MAX_AGE = 4;

/** Extracts the latest value per country, and the world total, for each energy column. */
export function energyTable(
  rows: Record<string, string>[],
  validIds: ReadonlySet<string>,
  maxYear: number,
): ResourceTable {
  const table: ResourceTable = {};
  for (const c of COMMODITIES) {
    if (!c.energyColumn) continue;
    const col = c.energyColumn;
    const num = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));
    const worldRows = rows
      .filter((r) => r.country === 'World' && num(r[col]) !== null && Number(r.year) <= maxYear)
      .sort((a, b) => Number(b.year) - Number(a.year));
    const w = worldRows[0];
    const minYear = w ? Number(w.year) - MAX_AGE : maxYear - MAX_AGE;
    const values = latestByCountry(
      rows
        .filter((r) => r.iso_code && Number(r.year) >= minYear)
        .map((r) => ({ id: r.iso_code!, year: Number(r.year), value: num(r[col]) })),
      validIds,
      maxYear,
    );
    table[c.id] = {
      production: {
        unit: 'TWh',
        values,
        ...(w ? { world: { value: num(w[col])!, year: Number(w.year) } } : {}),
        note: 'Primary energy content. Smaller producers are only published within regional totals.',
      },
    };
  }
  return table;
}

export async function runEnergy(): Promise<void> {
  console.log('energy: Energy Institute Statistical Review via Our World in Data');
  const { body, retrievedAt } = await cachedFetch(URL);
  const table = energyTable(parseCsv(body), await readCountryIds(), new Date().getUTCFullYear());
  const years = Object.values(table).flatMap((m) =>
    Object.values(m.production?.values ?? {}).map((o) => o.year),
  );
  const meta: DatasetMeta = {
    id: 'energy',
    title: 'Fossil fuel production',
    source:
      'Energy Institute, Statistical Review of World Energy (2025), via Our World in Data energy dataset (legacy release)',
    sourceUrl: 'https://github.com/owid/energy-data',
    license: 'CC BY 4.0 (Our World in Data); Energy Institute data used with attribution',
    retrievedAt,
    dataYear: years.length ? String(Math.max(...years)) : null,
    notes: 'Oil, gas and coal production in terawatt-hours of primary energy.',
  };
  await writeDataset(RESOURCE_FILES.energy, meta, table);
}
