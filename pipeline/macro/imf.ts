import { seriesFor, type SeriesTable } from '../../shared/indicators';
import type { DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { readCountryIds, writeDataset } from '../lib/write';
import { latestByCountry, type RawPoint } from './observations';

const API = 'https://www.imf.org/external/datamapper/api/v1';

/** IMF codes that differ from the ids used here. */
const IMF_TO_ID: Readonly<Record<string, string>> = { UVK: 'XKX', WBG: 'PSE' };

/** Parses an IMF DataMapper response: `{ values: { CODE: { ISO3: { year: value } } } }`. */
export function parseDataMapper(body: string, code: string): RawPoint[] {
  const json = JSON.parse(body) as {
    values?: Record<string, Record<string, Record<string, number | null>>>;
  };
  const byCountry = json.values?.[code];
  if (!byCountry) throw new Error(`IMF DataMapper returned no values for ${code}`);
  const points: RawPoint[] = [];
  for (const [imfId, years] of Object.entries(byCountry)) {
    const id = IMF_TO_ID[imfId] ?? imfId;
    for (const [year, value] of Object.entries(years)) {
      points.push({ id, year: Number(year), value });
    }
  }
  return points;
}

export async function runImf(): Promise<void> {
  console.log('imf: World Economic Outlook (DataMapper)');
  const ids = await readCountryIds();
  // WEO tables run years ahead as projections; only completed years are used.
  const lastCompleted = new Date().getUTCFullYear() - 1;
  const table: SeriesTable = {};
  let retrievedAt = '';
  for (const { code, scale } of seriesFor('imf')) {
    console.log(`  ${code}`);
    const res = await cachedFetch(`${API}/${encodeURIComponent(code)}`);
    table[code] = latestByCountry(parseDataMapper(res.body, code), ids, lastCompleted, scale);
    if (res.retrievedAt > retrievedAt) retrievedAt = res.retrievedAt;
  }
  const meta: DatasetMeta = {
    id: 'imf',
    title: 'IMF World Economic Outlook',
    source: 'International Monetary Fund, World Economic Outlook (DataMapper API)',
    sourceUrl: 'https://www.imf.org/external/datamapper/',
    license: 'IMF copyright; free reuse with attribution (imf.org/external/terms.htm)',
    retrievedAt,
    dataYear: `≤ ${lastCompleted}`,
    notes:
      'Latest completed year per country. Figures for the most recent year may be IMF staff estimates. Values in billions/millions are converted to units.',
  };
  await writeDataset('macro/imf.json', meta, table);
}
