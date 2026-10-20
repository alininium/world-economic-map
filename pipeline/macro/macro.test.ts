import { describe, expect, it } from 'vitest';
import { currenciesFromRows, parseCsv } from './currencies';
import { parseDataMapper } from './imf';
import { latestByCountry } from './observations';
import { parseWbPage } from './worldbank';

// Sample responses shaped like the real APIs; values are made up for the tests only.
const WB_PAGE = JSON.stringify([
  { page: 1, pages: 2, per_page: 4, total: 6, lastupdated: '2026-07-01' },
  [
    { countryiso3code: 'AAA', date: '2025', value: null },
    { countryiso3code: 'AAA', date: '2024', value: 10 },
    { countryiso3code: 'WLD', date: '2025', value: 99 },
    { countryiso3code: 'BBB', date: '2023', value: -2.5 },
  ],
]);

describe('parseWbPage', () => {
  it('reads paging metadata and points', () => {
    const { meta, points } = parseWbPage(WB_PAGE);
    expect(meta.pages).toBe(2);
    expect(points).toContainEqual({ id: 'AAA', year: 2024, value: 10 });
    expect(points).toHaveLength(4);
  });

  it('turns an API error message into an exception', () => {
    const err = JSON.stringify([
      { message: [{ id: '120', key: 'Invalid value', value: 'bad code' }] },
    ]);
    expect(() => parseWbPage(err)).toThrow('World Bank API: bad code');
  });

  it('treats a page with no rows as empty', () => {
    expect(parseWbPage(JSON.stringify([{ page: 1, pages: 0 }, null])).points).toEqual([]);
  });
});

describe('latestByCountry', () => {
  const ids = new Set(['AAA', 'BBB']);

  it('keeps the latest non-missing value and drops aggregates', () => {
    const { points } = parseWbPage(WB_PAGE);
    expect(latestByCountry(points, ids, 2026)).toEqual({
      AAA: { value: 10, year: 2024 },
      BBB: { value: -2.5, year: 2023 },
    });
  });

  it('ignores years after the cutoff (projections) and applies the unit scale', () => {
    const points = [
      { id: 'AAA', year: 2027, value: 5 },
      { id: 'AAA', year: 2025, value: 2 },
    ];
    expect(latestByCountry(points, ids, 2025, 1e9)).toEqual({ AAA: { value: 2e9, year: 2025 } });
  });

  it('leaves countries without data out instead of inventing a value', () => {
    expect(latestByCountry([{ id: 'AAA', year: 2024, value: null }], ids, 2026)).toEqual({});
  });
});

describe('parseDataMapper', () => {
  it('maps IMF-specific codes to the ids used here', () => {
    const body = JSON.stringify({
      values: { NGDPD: { UVK: { '2024': 1.5 }, WBG: { '2024': 2 }, USA: { '2024': 3 } } },
    });
    const ids = parseDataMapper(body, 'NGDPD').map((p) => p.id);
    expect(ids.sort()).toEqual(['PSE', 'USA', 'XKX']);
  });

  it('fails loudly when the series is absent', () => {
    expect(() => parseDataMapper(JSON.stringify({ values: {} }), 'NGDPD')).toThrow(/no values/);
  });
});

describe('currencies', () => {
  const csv = [
    'ISO3166-1-Alpha-3,ISO4217-currency_alphabetic_code,ISO4217-currency_name,official_name_en',
    'AAA,"VES,VED","Bolívar Soberano,Bolívar Soberano","Venezuela (Bolivarian Republic of)"',
    'BBB,,No universal currency,State of Palestine',
    'ZZZ,EUR,Euro,Not in our list',
  ].join('\r\n');

  it('parses quoted CSV fields containing commas', () => {
    const rows = parseCsv(csv);
    expect(rows[0]?.official_name_en).toBe('Venezuela (Bolivarian Republic of)');
    expect(rows).toHaveLength(3);
  });

  it('pairs codes with names and skips entries without a code', () => {
    expect(currenciesFromRows(parseCsv(csv), new Set(['AAA', 'BBB']))).toEqual({
      AAA: [
        { code: 'VES', name: 'Bolívar Soberano' },
        { code: 'VED', name: 'Bolívar Soberano' },
      ],
    });
  });
});
