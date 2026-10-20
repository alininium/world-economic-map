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
export const SOURCE_FLOWS = 'flows';
export const LAYER_FILL = 'country-fill';
export const LAYER_MARKERS = 'country-markers';
export const HATCH_IMAGE = 'hatch';
/** Layers that respond to hover and click. */
export const INTERACTIVE_LAYERS = [LAYER_FILL, LAYER_MARKERS];

type ColorExpr = DataDrivenPropertyValueSpecification<string>;

export const EMPTY_FLOWS: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
type SetPaint = Parameters<MapLibreMap['setPaintProperty']>;
type Paint = Record<string, SetPaint[2]>;

/** Country id → colour for the active metric; null when no metric is shown. */
export type FillColors = Readonly<Record<string, string>> | null;

const flag = (name: string) => ['boolean', ['feature-state', name], false];

const statusColor = (p: MapPalette): ColorExpr =>
  [
    'match',
    ['get', 'status'],
    ...(Object.entries(p.status) as [CountryStatus, string][]).flat(),
    p.status.other,
  ] as unknown as ColorExpr;

/** Without a metric, colour by status; with one, by class, and no-data countries in neutral grey. */
function fillColor(p: MapPalette, colors: FillColors): ColorExpr {
  if (!colors) return statusColor(p);
  const entries = Object.entries(colors);
  if (!entries.length) return p.noData;
  return ['match', ['get', 'id'], ...entries.flat(), p.noData] as unknown as ColorExpr;
}

/**
 * Colour-dependent paint for each layer; shared by the initial style, theme switches and
 * metric changes. Hover and selection are outlines so they never hide the metric colour.
 */
export function layerPaint(p: MapPalette, colors: FillColors): Record<string, Paint> {
  const fill = fillColor(p, colors);
  return {
    ocean: { 'background-color': p.ocean },
    [LAYER_FILL]: { 'fill-color': fill },
    'country-border': { 'line-color': p.border },
    'country-hover-outline': { 'line-color': p.hover },
    'country-selected-outline': { 'line-color': p.selected },
    'trade-flows': {
      'line-color': [
        'match',
        ['get', 'flow'],
        'exports',
        p.flowExports,
        p.flowImports,
      ] as unknown as ColorExpr,
    },
    [LAYER_MARKERS]: {
      'circle-color': fill,
      'circle-stroke-color': [
        'case',
        flag('selected'),
        p.selected,
        flag('hover'),
        p.hover,
        p.hatch,
      ] as unknown as ColorExpr,
    },
  };
}

/** Repaints an existing map without rebuilding sources or feature state. */
export function applyPaint(map: MapLibreMap, p: MapPalette, colors: FillColors): void {
  for (const [layer, paint] of Object.entries(layerPaint(p, colors))) {
    for (const [prop, value] of Object.entries(paint)) {
      map.setPaintProperty(layer, prop as SetPaint[1], value);
    }
  }
}

export function applyHatch(map: MapLibreMap, p: MapPalette): void {
  if (map.hasImage(HATCH_IMAGE)) map.updateImage(HATCH_IMAGE, hatchImage(p.hatch));
}

/**
 * A self-contained style with no basemap tiles: the app draws only its own country shapes,
 * so it needs no tile service or API key and works offline.
 */
export function buildStyle(
  p: MapPalette,
  features: MapFeatures,
  colors: FillColors,
): StyleSpecification {
  const paint = layerPaint(p, colors);
  return {
    version: 8,
    sources: {
      [SOURCE_SHAPES]: { type: 'geojson', data: features.shapes, promoteId: 'id' },
      [SOURCE_MARKERS]: { type: 'geojson', data: features.markers, promoteId: 'id' },
      [SOURCE_FLOWS]: { type: 'geojson', data: EMPTY_FLOWS },
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
        id: 'country-hover-outline',
        type: 'line',
        source: SOURCE_SHAPES,
        paint: {
          ...paint['country-hover-outline'],
          'line-width': 1.5,
          'line-opacity': ['case', flag('hover'), 1, 0],
        },
      },
      {
        id: 'country-selected-outline',
        type: 'line',
        source: SOURCE_SHAPES,
        paint: {
          ...paint['country-selected-outline'],
          'line-width': 2.5,
          'line-opacity': ['case', flag('selected'), 1, 0],
        },
      },
      {
        id: 'trade-flows',
        type: 'line',
        source: SOURCE_FLOWS,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          ...paint['trade-flows'],
          // 1.5 px for small partners up to 6 px for a partner taking half the trade.
          'line-width': ['interpolate', ['linear'], ['get', 'share'], 0, 1.5, 0.5, 6],
          'line-opacity': 0.85,
        },
      },
      {
        id: LAYER_MARKERS,
        type: 'circle',
        source: SOURCE_MARKERS,
        maxzoom: 5,
        paint: {
          ...paint[LAYER_MARKERS],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            ['case', flag('selected'), 4, 2.5],
            4,
            ['case', flag('selected'), 7, 5],
          ],
          'circle-stroke-width': ['case', ['any', flag('selected'), flag('hover')], 2, 1],
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
