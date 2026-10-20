import type {
  DataDrivenPropertyValueSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl';
import type { CountryStatus } from '../../shared/types';
import type { MapFeatures } from './geometry';
import type { MapPalette } from './palette';

export const SOURCE_SHAPES = 'countries';
export const SOURCE_MARKERS = 'markers';
export const LAYER_FILL = 'country-fill';
export const LAYER_MARKERS = 'country-markers';
export const HATCH_IMAGE = 'hatch';
/** Layers that respond to hover and click. */
export const INTERACTIVE_LAYERS = [LAYER_FILL, LAYER_MARKERS];

const byState = (p: MapPalette, base: DataDrivenPropertyValueSpecification<string>) =>
  [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    p.selected,
    ['boolean', ['feature-state', 'hover'], false],
    p.hover,
    base,
  ] as DataDrivenPropertyValueSpecification<string>;

const statusColor = (p: MapPalette) =>
  [
    'match',
    ['get', 'status'],
    ...(Object.entries(p.status) as [CountryStatus, string][]).flat(),
    p.status.other,
  ] as unknown as DataDrivenPropertyValueSpecification<string>;

type SetPaint = Parameters<MapLibreMap['setPaintProperty']>;
type Paint = Record<string, SetPaint[2]>;

/** Colour-dependent paint for each layer; shared by the initial style and theme switches. */
export function layerPaint(p: MapPalette): Record<string, Paint> {
  return {
    ocean: { 'background-color': p.ocean },
    [LAYER_FILL]: { 'fill-color': byState(p, statusColor(p)) },
    'country-border': { 'line-color': p.border },
    'country-selected-outline': { 'line-color': p.selected },
    [LAYER_MARKERS]: {
      'circle-color': byState(p, statusColor(p)),
      'circle-stroke-color': p.hatch,
    },
  };
}

/** Repaints an existing map for a new palette without rebuilding sources or feature state. */
export function applyPalette(map: MapLibreMap, p: MapPalette): void {
  for (const [layer, paint] of Object.entries(layerPaint(p))) {
    for (const [prop, value] of Object.entries(paint)) {
      map.setPaintProperty(layer, prop as SetPaint[1], value);
    }
  }
  if (map.hasImage(HATCH_IMAGE)) map.updateImage(HATCH_IMAGE, hatchImage(p.hatch));
}

/**
 * A self-contained style with no basemap tiles: the app draws only its own country shapes,
 * so it needs no tile service or API key and works offline.
 */
export function buildStyle(p: MapPalette, features: MapFeatures): StyleSpecification {
  const paint = layerPaint(p);
  return {
    version: 8,
    sources: {
      [SOURCE_SHAPES]: { type: 'geojson', data: features.shapes, promoteId: 'id' },
      [SOURCE_MARKERS]: { type: 'geojson', data: features.markers, promoteId: 'id' },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: paint.ocean },
      { id: LAYER_FILL, type: 'fill', source: SOURCE_SHAPES, paint: paint[LAYER_FILL] },
      {
        id: 'disputed-hatch',
        type: 'fill',
        source: SOURCE_SHAPES,
        filter: ['==', ['get', 'status'], 'disputed'],
        paint: { 'fill-pattern': HATCH_IMAGE },
      },
      {
        id: 'country-border',
        type: 'line',
        source: SOURCE_SHAPES,
        paint: {
          ...paint['country-border'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2],
        },
      },
      {
        id: 'country-selected-outline',
        type: 'line',
        source: SOURCE_SHAPES,
        paint: {
          ...paint['country-selected-outline'],
          'line-width': 2,
          'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0],
        },
      },
      {
        id: LAYER_MARKERS,
        type: 'circle',
        source: SOURCE_MARKERS,
        maxzoom: 5,
        paint: {
          ...paint[LAYER_MARKERS],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.5, 4, 5],
          'circle-stroke-width': 1,
        },
      },
    ] as StyleSpecification['layers'],
  };
}

/** Diagonal stripes for disputed territories. */
export function hatchImage(color: string, size = 8): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const offset of [-size, 0, size]) {
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}
