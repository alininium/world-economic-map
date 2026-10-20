import { Unzip, UnzipInflate } from 'fflate';
import { COMMODITIES, RESOURCE_FILES, type ResourceTable } from '../../shared/commodities';
import type { Country, Dataset, DatasetMeta } from '../../shared/types';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cachedFetchBinary } from '../lib/fetch';
import { DATA_DIR, writeDataset } from '../lib/write';
import { parseCsv } from '../macro/currencies';
import { latestByCountry, type RawPoint } from '../macro/observations';

/** FAOSTAT bulk download, Crops and livestock products (QCL), normalized layout. */
const DEFAULT_URL =
  'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip';
/** FAOSTAT element code for production quantity. */
const PRODUCTION = '5510';
/** FAOSTAT area code for the world aggregate. */
const WORLD_AREA = '5000';

/**
 * Streams the CSV file(s) in a zip accepted by `pick`, handing each line to `onLine`, so a
 * several-hundred-megabyte file is never held in memory as one string. FAOSTAT archives also
 * hold code lists (AreaCodes, Elements, Flags…); `pick` keeps them out.
 */
export function streamZipLines(
  zip: Uint8Array,
  onLine: (line: string) => void,
  pick: (name: string) => boolean = (n) => n.toLowerCase().endsWith('.csv'),
): void {
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  const decoder = new TextDecoder('utf-8');
  let rest = '';
  unzip.onfile = (file) => {
    if (!pick(file.name)) return;
    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      const text = rest + decoder.decode(chunk, { stream: !final });
      const lines = text.split(/\r?\n/);
      rest = final ? '' : (lines.pop() ?? '');
      for (const l of lines) if (l) onLine(l);
    };
    file.start();
  };
  unzip.push(zip, true);
}

/** The archive's data table, not its code lists. */
export const isMainDataFile = (name: string): boolean =>
  /All_Data.*\.csv$/i.test(name) && !/(AreaCodes|Elements|Flags|ItemCodes)/i.test(name);

export interface FaoRow {
  'Area Code': string;
  'Area Code (M49)': string;
  'Item Code': string;
  'Element Code': string;
  Year: string;
  Unit: string;
  Value: string;
}

/** Production by country (via M49) and the world total, per configured FAO item. */
export function faoTable(
  rows: readonly FaoRow[],
  m49ToId: ReadonlyMap<string, string>,
  maxYear: number,
): ResourceTable {
  const table: ResourceTable = {};
  for (const c of COMMODITIES) {
    if (!c.faoItem) continue;
    const mine = rows.filter(
      (r) => r['Item Code'] === c.faoItem && r['Element Code'] === PRODUCTION,
    );
    const points: RawPoint[] = [];
    let world: { value: number; year: number } | undefined;
    for (const r of mine) {
      const year = Number(r.Year);
      const value = r.Value === '' ? null : Number(r.Value);
      if (r['Area Code'] === WORLD_AREA) {
        if (value !== null && year <= maxYear && (!world || year > world.year))
          world = { value, year };
        continue;
      }
      const id = m49ToId.get(r['Area Code (M49)'].replace(/^'/, ''));
      if (id) points.push({ id, year, value });
    }
    table[c.id] = {
      production: {
        unit: mine[0]?.Unit === 't' || !mine[0] ? 'tonnes' : mine[0].Unit,
        values: latestByCountry(points, new Set(m49ToId.values()), maxYear),
        ...(world ? { world } : {}),
      },
    };
  }
  return table;
}

export async function runFao(): Promise<void> {
  const url = process.env.FAOSTAT_QCL_URL || DEFAULT_URL;
  console.log(`fao: FAOSTAT crops production (${url})`);
  const { data, retrievedAt } = await cachedFetchBinary(url);
  const items = new Set(COMMODITIES.flatMap((c) => (c.faoItem ? [c.faoItem] : [])));
  let header: string | null = null;
  const kept: string[] = [];
  // Cheap text pre-filter so only a few thousand lines reach the CSV parser: the line must hold
  // the production element code and one of our item codes as quoted fields.
  const itemNeedles = [...items].map((i) => `"${i}"`);
  streamZipLines(
    data,
    (line) => {
      if (header === null) {
        header = line;
        return;
      }
      if (!line.includes(`"${PRODUCTION}"`)) return;
      if (!itemNeedles.some((n) => line.includes(n))) return;
      kept.push(line);
    },
    isMainDataFile,
  );
  if (!header) throw new Error('FAOSTAT archive contained no CSV');
  const rows = (parseCsv([header, ...kept].join('\n')) as unknown as FaoRow[]).filter((r) =>
    items.has(r['Item Code']),
  );
  const countries = JSON.parse(
    await readFile(path.join(DATA_DIR, 'countries.json'), 'utf8'),
  ) as Dataset<Country[]>;
  const m49 = new Map(
    countries.data.flatMap((c) => (c.isoNumeric ? [[c.isoNumeric, c.id] as const] : [])),
  );
  const table = faoTable(rows, m49, new Date().getUTCFullYear());
  const years = Object.values(table).flatMap((m) =>
    Object.values(m.production?.values ?? {}).map((o) => o.year),
  );
  const meta: DatasetMeta = {
    id: 'fao',
    title: 'Crop production',
    source: 'FAO, FAOSTAT Crops and livestock products (QCL), bulk download',
    sourceUrl: 'https://www.fao.org/faostat/en/#data/QCL',
    license: 'CC BY 4.0 (FAO statistical databases)',
    retrievedAt,
    dataYear: years.length ? String(Math.max(...years)) : null,
    notes:
      'Production quantity in tonnes. China is FAOSTAT “China, mainland” (M49 156); Taiwan is reported separately.',
  };
  await writeDataset(RESOURCE_FILES.fao, meta, table);
}
