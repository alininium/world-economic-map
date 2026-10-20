import { describe, expect, it } from 'vitest';
import type { TradeProfile } from '../../shared/trade';
import type { Country } from '../../shared/types';
import { flowLines, greatCircle } from './flows';

describe('greatCircle', () => {
  it('starts and ends at the given points', () => {
    const pts = greatCircle([2.35, 48.85], [-74, 40.7], 16);
    expect(pts[0]![0]).toBeCloseTo(2.35);
    expect(pts.at(-1)![1]).toBeCloseTo(40.7);
    expect(pts).toHaveLength(17);
  });

  it('bows towards the pole between mid-latitude points', () => {
    const pts = greatCircle([2.35, 48.85], [-74, 40.7], 16);
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(50);
  });

  it('stays continuous across the antimeridian', () => {
    const pts = greatCircle([170, -40], [-170, -20], 16);
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i]![0] - pts[i - 1]![0])).toBeLessThan(10);
    }
    expect(pts.at(-1)![0]).toBeCloseTo(190);
  });
});

const country = (id: string, label: [number, number]): Country => ({
  id,
  iso3: id,
  iso2: null,
  isoNumeric: null,
  name: id,
  formalName: null,
  status: 'un_member',
  sovereign: null,
  region: null,
  subregion: null,
  label,
  bbox: [0, 0, 1, 1],
  tiny: false,
  aliases: [],
});

describe('flowLines', () => {
  const countries = new Map([
    ['AAA', country('AAA', [0, 0])],
    ['BBB', country('BBB', [10, 10])],
    ['CCC', country('CCC', [20, 0])],
  ]);
  const profile: TradeProfile = {
    year: 2024,
    exports: {
      total: 100,
      products: [],
      partners: [
        { code: 'BBB', name: 'B', value: 50, share: 0.5, partnerId: 'BBB' },
        { code: '899', name: 'Areas, nes', value: 30, share: 0.3, partnerId: null },
      ],
    },
    imports: {
      total: 80,
      products: [],
      partners: [{ code: 'CCC', name: 'C', value: 80, share: 1, partnerId: 'CCC' }],
    },
  };

  it('draws exports outward and imports inward, skipping non-country partners', () => {
    const fc = flowLines(countries.get('AAA')!, profile, countries);
    expect(fc.features.map((f) => [f.properties.flow, f.properties.partner])).toEqual([
      ['exports', 'BBB'],
      ['imports', 'CCC'],
    ]);
    const imp = fc.features[1]!.geometry.coordinates;
    expect(imp[0]![0]).toBeCloseTo(20);
    expect(imp.at(-1)![0]).toBeCloseTo(0);
  });

  it('keeps import and export lines in the same world copy across the Pacific', () => {
    const pacific = new Map([
      ['USA', country('USA', [-98, 39])],
      ['CHN', country('CHN', [104, 35])],
    ]);
    const chn = { code: 'CHN', name: 'C', value: 1, share: 1, partnerId: 'CHN' };
    const both: TradeProfile = {
      year: 2024,
      exports: { total: 1, products: [], partners: [chn] },
      imports: { total: 1, products: [], partners: [chn] },
    };
    const [exp, imp] = flowLines(pacific.get('USA')!, both, pacific).features;
    expect(exp!.geometry.coordinates[0]![0]).toBeCloseTo(-98);
    expect(imp!.geometry.coordinates.at(-1)![0]).toBeCloseTo(-98);
    expect(imp!.geometry.coordinates[0]![0]).toBeCloseTo(exp!.geometry.coordinates.at(-1)![0]!);
  });
});
