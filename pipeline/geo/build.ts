import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import { feature, mergeArcs, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { Country, DatasetMeta } from '../../shared/types';
import { cachedFetch } from '../lib/fetch';
import { recordInManifest, writeDataset, writeRaw } from '../lib/write';
import { approxArea, bboxOfRings, classifyFeature, type NeProps } from './classify';
import { DISPLAY_NAMES } from './territories';

const NE_VERSION = 'v5.1.2';
const NE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson/ne_50m_admin_0_countries.geojson`;

/** Shapes smaller than this (≈ square degrees at the equator) get a clickable marker. */
const TINY_AREA = 0.5;
/** Simplification threshold in square degrees of triangle area; keeps coastlines readable at country zoom. */
const SIMPLIFY_WEIGHT = 0.002;
/** Grid used to delta-encode coordinates; 1e5 steps is ~400 m at the equator. */
const QUANTIZATION = 1e5;
const ALIAS_FIELDS = [
  'NAME',
  'NAME_EN',
  'NAME_FR',
  'NAME_PL',
  'NAME_RU',
  'NAME_DE',
  'NAME_ES',
] as const;

type NeFeature = Feature<
  Polygon | MultiPolygon,
  NeProps & { ADMIN: string; FORMAL_EN: string | null }
>;

function ringsOf(g: Geometry): number[][][] {
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  return [];
}

export interface GeoBuildResult {
  countries: Country[];
  topo: Topology;
}

/** Turns Natural Earth admin-0 features into one shape and one metadata record per entity. */
export function buildGeo(fc: FeatureCollection): GeoBuildResult {
  const groups = new Map<string, { primary?: NeFeature; parts: NeFeature[] }>();
  const meta = new Map<string, { iso3: string | null; status: Country['status'] }>();
  for (const f of fc.features as NeFeature[]) {
    const c = classifyFeature(f.properties);
    const id = c.kind === 'merge' ? c.into : c.id;
    const group = groups.get(id) ?? { parts: [] };
    group.parts.push(f);
    // Several NE shapes can carry the same ISO code (Australia's external territories are
    // coded AUS); the shape whose own NE code is the id, or that an override names, is the
    // entity and the rest become parts of it.
    const isOwnShape = c.kind === 'entity' && (f.properties.ADM0_A3 === id || !group.primary);
    if (isOwnShape) {
      group.primary = f;
      meta.set(id, { iso3: c.iso3, status: c.status });
    }
    groups.set(id, group);
  }

  const parts: Feature[] = [];
  for (const [id, g] of groups) {
    if (!g.primary) throw new Error(`Natural Earth has no main shape for ${id}`);
    for (const p of g.parts)
      parts.push({ type: 'Feature', id, properties: {}, geometry: p.geometry });
  }
  const raw = topology({
    countries: { type: 'FeatureCollection', features: parts } as FeatureCollection,
  }) as Parameters<typeof presimplify>[0];
  // simplify() leaves absolute coordinates, so quantize afterwards to keep the file small.
  const simplified = quantize(simplify(presimplify(raw), SIMPLIFY_WEIGHT), QUANTIZATION);

  // Merge the parts of each entity into one geometry so internal borders disappear.
  const object = simplified.objects.countries as GeometryCollection;
  const byId = new Map<string, GeometryObject[]>();
  for (const geom of object.geometries) {
    const id = String(geom.id);
    byId.set(id, [...(byId.get(id) ?? []), geom]);
  }
  object.geometries = [...byId].map(([id, geoms]) => {
    const merged =
      geoms.length === 1 ? geoms[0]! : (mergeArcs(simplified, geoms as never) as GeometryObject);
    return { ...merged, id };
  });

  const nameToId = new Map<string, string>();
  for (const [id, g] of groups) nameToId.set(g.primary!.properties.ADMIN, id);

  const countries: Country[] = object.geometries.map((geom) => {
    const id = String(geom.id);
    const p = groups.get(id)!.primary!.properties;
    const m = meta.get(id)!;
    const shape = feature(simplified, geom) as Feature;
    const rings = ringsOf(shape.geometry);
    const name = DISPLAY_NAMES[id] ?? (p.NAME_LONG || p.NAME);
    const aliases = new Set<string>([p.NAME_LONG]);
    for (const field of ALIAS_FIELDS) {
      const v = p[field];
      if (typeof v === 'string' && v && v !== name) aliases.add(v);
    }
    if (p.FORMAL_EN) aliases.add(p.FORMAL_EN);
    aliases.delete(name);
    return {
      id,
      iso3: m.iso3,
      iso2: m.iso3 && /^[A-Z]{2}$/.test(p.ISO_A2_EH) ? p.ISO_A2_EH : null,
      isoNumeric: m.iso3 && /^\d{3}$/.test(p.ISO_N3_EH) ? p.ISO_N3_EH : null,
      name,
      // A disputed territory's formal name is one claimant's name for it; leave it out.
      formalName: m.status === 'disputed' ? null : p.FORMAL_EN || null,
      status: m.status,
      sovereign: m.status === 'dependency' ? (nameToId.get(p.SOVEREIGNT) ?? null) : null,
      region: p.REGION_UN || null,
      subregion: p.SUBREGION || null,
      label: [p.LABEL_X, p.LABEL_Y],
      bbox: bboxOfRings(rings),
      tiny: approxArea(rings) < TINY_AREA,
      aliases: [...aliases],
    };
  });
  countries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return { countries, topo: simplified };
}

export async function runGeo(): Promise<void> {
  console.log('geo: Natural Earth admin-0 countries');
  const { body, retrievedAt } = await cachedFetch(NE_URL);
  const fc = JSON.parse(body) as FeatureCollection;
  const { countries, topo } = buildGeo(fc);
  const base: Omit<DatasetMeta, 'id' | 'title'> = {
    source: `Natural Earth 1:50m Admin 0 – Countries (${NE_VERSION}); territory policy in pipeline/geo/territories.ts`,
    sourceUrl: 'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/',
    license: 'Public domain (Natural Earth terms of use)',
    retrievedAt,
    dataYear: NE_VERSION,
  };
  await writeRaw('geo/countries.topo.json', topo);
  await recordInManifest('geo/countries.topo.json', {
    ...base,
    id: 'geo',
    title: 'Country boundaries (TopoJSON)',
  });
  await writeDataset(
    'countries.json',
    { ...base, id: 'countries', title: 'Country list' },
    countries,
  );
  const counts = Object.groupBy(countries, (c) => c.status);
  console.log(
    '  ' +
      Object.entries(counts)
        .map(([k, v]) => `${k}: ${v?.length ?? 0}`)
        .join(', '),
  );
}
