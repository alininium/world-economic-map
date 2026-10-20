import type { Feature, FeatureCollection, Point } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Country, CountryStatus } from '../../shared/types';

export interface ShapeProps {
  id: string;
  status: CountryStatus;
}

export interface MapFeatures {
  shapes: FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, ShapeProps>;
  /** Clickable dots for countries too small to hit as polygons at world zoom. */
  markers: FeatureCollection<Point, ShapeProps>;
}

export function toMapFeatures(topo: Topology, countries: readonly Country[]): MapFeatures {
  const byId = new Map(countries.map((c) => [c.id, c]));
  const fc = feature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection;
  const shapes: MapFeatures['shapes'] = {
    type: 'FeatureCollection',
    features: fc.features.flatMap((f) => {
      const c = byId.get(String(f.id));
      if (!c) return [];
      return [
        {
          ...f,
          properties: { id: c.id, status: c.status },
        } as MapFeatures['shapes']['features'][number],
      ];
    }),
  };
  const markers: MapFeatures['markers'] = {
    type: 'FeatureCollection',
    features: countries
      .filter((c) => c.tiny)
      .map((c): Feature<Point, ShapeProps> => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: c.label },
        properties: { id: c.id, status: c.status },
      })),
  };
  return { shapes, markers };
}
