import type { CurrencyTable } from '../../shared/indicators';
import type { DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { readCountryIds, writeDataset } from '../lib/write';

const URL = 'https://raw.githubusercontent.com/datasets/country-codes/main/data/country-codes.csv';

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, commas inside quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((f) => f !== ''));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Pairs the comma-separated ISO 4217 code and name columns into currency records. */
export function currenciesFromRows(
  rows: Record<string, string>[],
  validIds: ReadonlySet<string>,
): CurrencyTable {
  const out: CurrencyTable = {};
  for (const r of rows) {
    const id = r['ISO3166-1-Alpha-3'];
    if (!id || !validIds.has(id)) continue;
    const codes = (r['ISO4217-currency_alphabetic_code'] ?? '').split(',').map((s) => s.trim());
    const names = (r['ISO4217-currency_name'] ?? '').split(',').map((s) => s.trim());
    const list = codes
      .map((code, i) => ({ code, name: names[i] ?? code }))
      .filter((c) => /^[A-Z]{3}$/.test(c.code));
    if (list.length) out[id] = list;
  }
  return out;
}

export async function runCurrencies(): Promise<void> {
  console.log('currencies: ISO 4217 via datasets/country-codes');
  const { body, retrievedAt } = await cachedFetch(URL);
  const table = currenciesFromRows(parseCsv(body), await readCountryIds());
  const meta: DatasetMeta = {
    id: 'currencies',
    title: 'Currencies in use',
    source:
      'ISO 4217 (SIX Group, maintenance agency), as compiled in the datasets/country-codes package',
    sourceUrl: 'https://github.com/datasets/country-codes',
    license: 'ODC-PDDL-1.0 (compilation)',
    retrievedAt,
    dataYear: `current as of ${retrievedAt}`,
    notes: 'Entities without an ISO 3166 code (e.g. Kosovo) have no ISO 4217 listing.',
  };
  await writeDataset('currencies.json', meta, table);
}
