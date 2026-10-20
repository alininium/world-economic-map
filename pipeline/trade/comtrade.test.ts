import { describe, expect, it } from 'vitest';
import {
  buildProfile,
  chainTrade,
  byReporter,
  hhi,
  hsNames,
  latestYear,
  parseRows,
  partnerLookup,
  reporterCodes,
  type ComtradeRow,
} from './comtrade';

// Shapes follow the Comtrade v1 API and reference files; values are invented for the tests.
const ids = new Set(['USA', 'CHE', 'FRA', 'CHN']);

describe('reference files', () => {
  it('keeps only current, non-group reporter codes', () => {
    const map = reporterCodes(
      [
        {
          reporterCode: 841,
          reporterCodeIsoAlpha3: 'USA',
          isGroup: false,
          entryExpiredDate: '1980-12-31',
        },
        { reporterCode: 842, reporterCodeIsoAlpha3: 'USA', isGroup: false },
        { reporterCode: 757, reporterCodeIsoAlpha3: 'CHE', isGroup: false },
        { reporterCode: 97, reporterCodeIsoAlpha3: 'EUR', isGroup: true },
      ],
      ids,
    );
    expect(Object.fromEntries(map)).toEqual({ USA: 842, CHE: 757 });
  });

  it('maps partners to entities and keeps non-country partners by name', () => {
    const map = partnerLookup(
      [
        { PartnerCode: 251, PartnerDesc: 'France', PartnerCodeIsoAlpha3: 'FRA', isGroup: false },
        {
          PartnerCode: 899,
          PartnerDesc: 'Areas, nes',
          PartnerCodeIsoAlpha3: '_X ',
          isGroup: false,
        },
        {
          PartnerCode: 490,
          PartnerDesc: 'Other Asia, nes',
          PartnerCodeIsoAlpha3: 'S19',
          isGroup: false,
        },
      ],
      ids,
    );
    expect(map.get(251)).toEqual({ code: 'FRA', name: 'France', id: 'FRA' });
    expect(map.get(899)).toEqual({ code: '899', name: 'Areas, nes', id: null });
    expect(map.get(490)?.id).toBeNull();
  });

  it('strips the code prefix from HS descriptions', () => {
    const names = hsNames([{ id: '8471', text: '8471 - Automatic data processing machines' }]);
    expect(names.get('8471')).toBe('Automatic data processing machines');
  });
});

describe('parseRows', () => {
  it('surfaces API errors', () => {
    expect(() => parseRows(JSON.stringify({ data: null, error: 'Invalid key' }))).toThrow(
      'Comtrade API: Invalid key',
    );
  });
});

const row = (partial: Partial<ComtradeRow>): ComtradeRow => ({
  reporterCode: 842,
  partnerCode: 0,
  flowCode: 'X',
  cmdCode: 'TOTAL',
  period: '2024',
  primaryValue: 0,
  ...partial,
});

describe('latestYear', () => {
  it('picks the latest year with reported exports to the world', () => {
    const rows = [
      row({ period: '2023', primaryValue: 100 }),
      row({ period: '2024', primaryValue: 120 }),
      row({ period: '2025', primaryValue: null }),
      row({ reporterCode: 251, period: '2025', primaryValue: 5 }),
    ];
    expect(latestYear(rows, 842)).toBe(2024);
    expect(latestYear(rows, 999)).toBeNull();
  });
});

describe('hhi', () => {
  it('is 1 for a single product and 1/n for n equal products', () => {
    expect(hhi([5])).toBe(1);
    expect(hhi([1, 1, 1, 1])).toBeCloseTo(0.25);
    expect(hhi([])).toBeNull();
  });
});

describe('buildProfile', () => {
  const partners = partnerLookup(
    [
      { PartnerCode: 251, PartnerDesc: 'France', PartnerCodeIsoAlpha3: 'FRA', isGroup: false },
      { PartnerCode: 156, PartnerDesc: 'China', PartnerCodeIsoAlpha3: 'CHN', isGroup: false },
    ],
    ids,
  );
  const products = new Map([
    ['2709', 'Crude petroleum oils'],
    ['8703', 'Motor cars'],
  ]);
  const partnerRows = [
    row({ partnerCode: 0, primaryValue: 100 }),
    row({ partnerCode: 251, primaryValue: 60 }),
    row({ partnerCode: 156, primaryValue: 40 }),
    row({ partnerCode: 156, primaryValue: 999, period: '2023' }),
    row({ flowCode: 'M', partnerCode: 0, primaryValue: 80 }),
    row({ flowCode: 'M', partnerCode: 156, primaryValue: 80 }),
  ];
  const productRows = [
    row({ cmdCode: '2709', primaryValue: 75 }),
    row({ cmdCode: '8703', primaryValue: 25 }),
    row({ flowCode: 'M', cmdCode: '8703', primaryValue: 80 }),
  ];
  const { profile, exportHhi } = buildProfile(
    842,
    2024,
    partnerRows,
    productRows,
    partners,
    products,
  );

  it('ranks partners and products with shares of the world total', () => {
    expect(profile.exports.total).toBe(100);
    expect(profile.exports.partners).toEqual([
      { code: 'FRA', name: 'France', value: 60, share: 0.6, partnerId: 'FRA' },
      { code: 'CHN', name: 'China', value: 40, share: 0.4, partnerId: 'CHN' },
    ]);
    expect(profile.exports.products[0]).toEqual({
      code: '2709',
      name: 'Crude petroleum oils',
      value: 75,
      share: 0.75,
    });
  });

  it('uses only the chosen year', () => {
    expect(profile.exports.partners.find((p) => p.code === 'CHN')?.value).toBe(40);
  });

  it('computes export concentration from product shares', () => {
    expect(exportHhi).toBeCloseTo(0.75 ** 2 + 0.25 ** 2);
  });

  it('marks a flow without a world total as missing', () => {
    const { profile: p } = buildProfile(842, 2024, partnerRows.slice(0, 4), [], partners, products);
    expect(p.imports).toEqual({ total: null, products: [], partners: [] });
  });
});

describe('byReporter', () => {
  it('groups rows by reporter code', () => {
    const groups = byReporter([
      row({ reporterCode: 1 }),
      row({ reporterCode: 2 }),
      row({ reporterCode: 1, partnerCode: 5 }),
    ]);
    expect(groups.get(1)).toHaveLength(2);
    expect(groups.get(2)).toHaveLength(1);
  });
});

describe('chainTrade', () => {
  it('sums each stage’s HS codes per reporter and skips stages without codes', () => {
    const t = chainTrade(
      [
        row({ cmdCode: '8542', primaryValue: 50, reporterCode: 410 }),
        row({ cmdCode: '8542', primaryValue: 30, flowCode: 'M', reporterCode: 156 }),
        row({ cmdCode: '8471', primaryValue: 10, reporterCode: 156 }),
        row({ cmdCode: '8517', primaryValue: 5, reporterCode: 156 }),
      ],
      new Map([
        [410, 'KOR'],
        [156, 'CHN'],
      ]),
    );
    expect(t.semiconductors?.chips?.exports).toEqual({ KOR: { value: 50, year: 2024 } });
    expect(t.semiconductors?.chips?.imports).toEqual({ CHN: { value: 30, year: 2024 } });
    expect(t.semiconductors?.devices?.exports).toEqual({ CHN: { value: 15, year: 2024 } });
    expect(t.semiconductors?.design).toBeUndefined();
  });
});
