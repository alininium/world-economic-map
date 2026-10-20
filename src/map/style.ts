import type { DataDrivenPropertyValueSpecification, StyleSpecification } from 'maplibre-gl';
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

/**
 * A self-contained style with no basemap tiles: the app draws only its own country shapes,
 * so it needs no tile service or API key and works offline.
 */
export function buildStyle(p: MapPalette, features: MapFeatures): StyleSpecification {
  return {
    version: 8,
    sources: {
      [SOURCE_SHAPES]: { type: 'geojson', data: features.shapes, promoteId: 'id' },
      [SOURCE_MARKERS]: { type: 'geojson', data: features.markers, promoteId: 'id' },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': p.ocean } },
      {
        id: LAYER_FILL,
        type: 'fill',
        source: SOURCE_SHAPES,
        paint: { 'fill-color': byState(p, statusColor(p)) },
      },
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
          'line-color': p.border,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2],
        },
      },
      {
        id: 'country-selected-outline',
        type: 'line',
        source: SOURCE_SHAPES,
        paint: {
          'line-color': p.selected,
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
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2.5, 4, 5],
          'circle-color': byState(p, statusColor(p)),
          'circle-stroke-color': p.hatch,
          'circle-stroke-width': 1,
        },
      },
    ],
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
