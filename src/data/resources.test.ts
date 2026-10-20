import { describe, expect, it } from 'vitest';
import type { DatasetMeta } from '../../shared/types';
import { buildResourceIndex, countryResources, ranking } from './resources';

const meta = (id: string): DatasetMeta => ({
  id,
  title: id,
  source: id,
  sourceUrl: '',
  license: '',
  retrievedAt: '2026-10-20',
  dataYear: null,
});

// Invented values; only the merging and ranking logic is under test.
const index = buildResourceIndex([
  {
    meta: meta('usgs'),
    data: {
      lithium: {
        production: {
          unit: 't',
          values: {
            AUS: { value: 80, year: 2024 },
            CHL: { value: 40, year: 2024 },
            ARG: { value: 10, year: 2023 },
            GIB: { value: 0, year: 2024 },
          },
          world: { value: 200, year: 2024 },
        },
      },
    },
  },
  {
    meta: meta('trade'),
    data: {
      lithium: {
        production: { unit: 'x', values: { ZZZ: { value: 1, year: 2024 } } },
        exports: { unit: 'US dollars', values: { CHL: { value: 5, year: 2024 } } },
      },
    },
  },
]);

describe('buildResourceIndex', () => {
  it('keeps the first source for a measure and adds measures from later ones', () => {
    expect(index.lithium?.production?.meta.id).toBe('usgs');
    expect(index.lithium?.exports?.meta.id).toBe('trade');
  });
});

describe('ranking', () => {
  it('orders producers, skips zeros and only gives shares for the world total’s year', () => {
    const r = ranking(index.lithium!.production!.table);
    expect(r.map((x) => [x.id, x.rank, x.share])).toEqual([
      ['AUS', 1, 0.4],
      ['CHL', 2, 0.2],
      ['ARG', 3, null],
    ]);
  });
});

describe('countryResources', () => {
  it('lists every measure a country appears in, with rank among ranked countries', () => {
    const rows = countryResources(index, 'CHL', (id) => id !== 'AUS');
    expect(rows.map((r) => [r.measure, r.rank, r.of])).toEqual([
      ['production', 1, 2],
      ['exports', 1, 1],
    ]);
  });
});
