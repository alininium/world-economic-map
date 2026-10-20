import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import { buildGeo } from './build';

const square = (x: number, y: number, size = 2) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ],
});

const props = (adm0: string, iso: string, extra: Record<string, unknown> = {}) => ({
  ADM0_A3: adm0,
  ISO_A3_EH: iso,
  ISO_A2_EH: iso.slice(0, 2),
  SOVEREIGNT: adm0,
  ADMIN: adm0,
  NAME: adm0,
  NAME_LONG: adm0,
  FORMAL_EN: null,
  REGION_UN: 'Africa',
  SUBREGION: 'Eastern Africa',
  LABEL_X: 0,
  LABEL_Y: 0,
  ...extra,
});

describe('buildGeo', () => {
  const fc: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: props('SOM', 'SOM'), geometry: square(0, 0) },
      { type: 'Feature', properties: props('SOL', '-99'), geometry: square(2, 0) },
      { type: 'Feature', properties: props('AUS', 'AUS'), geometry: square(20, 0) },
      {
        type: 'Feature',
        properties: props('IOA', 'AUS', { ADMIN: 'Indian Ocean Ter.', SOVEREIGNT: 'AUS' }),
        geometry: square(30, 0, 0.1),
      },
      {
        type: 'Feature',
        properties: props('NFK', 'NFK', { SOVEREIGNT: 'AUS' }),
        geometry: square(40, 0, 0.1),
      },
    ],
  };
  const { countries, topo } = buildGeo(fc);
  const byId = Object.fromEntries(countries.map((c) => [c.id, c]));

  it('emits one entity per id, merging breakaway shapes and same-ISO territories', () => {
    expect(Object.keys(byId).sort()).toEqual(['AUS', 'NFK', 'SOM']);
    const geoms = (topo.objects.countries as { geometries: { id: string }[] }).geometries;
    expect(geoms.map((g) => g.id).sort()).toEqual(['AUS', 'NFK', 'SOM']);
  });

  it("keeps the main shape's metadata and covers merged parts in the bbox", () => {
    expect(byId.AUS?.name).toBe('AUS');
    expect(byId.SOM?.bbox[2]).toBeCloseTo(4, 3);
  });

  it('links dependencies to their sovereign and flags tiny shapes', () => {
    expect(byId.NFK).toMatchObject({ status: 'dependency', sovereign: 'AUS', tiny: true });
    expect(byId.SOM?.tiny).toBe(false);
  });
});
