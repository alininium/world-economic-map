import type { CountryStatus } from '../../shared/types';

/**
 * Map colours per theme. The choropleth ramps come from the dataviz reference palette
 * (blue sequential; blue/red diverging) and were checked with its validator against the
 * ocean colour of each theme: monotone lightness, visible steps, ≥2:1 at the surface end.
 */
export interface MapPalette {
  ocean: string;
  border: string;
  hover: string;
  selected: string;
  hatch: string;
  /** Countries without a value for the active metric. */
  noData: string;
  status: Record<CountryStatus, string>;
  /** Low → high. */
  sequential: string[];
  /** Most negative → closest to zero. */
  negative: string[];
  /** Closest to zero → most positive. */
  positive: string[];
  /** Trade-flow lines: categorical slots 1 (blue) and 2 (orange) of the reference palette. */
  flowExports: string;
  flowImports: string;
}

const light: MapPalette = {
  ocean: '#fbfbf9',
  border: '#fbfbf9',
  hover: '#7d7c76',
  selected: '#0b0b0b',
  hatch: '#7d7c76',
  noData: '#d6d4ce',
  status: {
    un_member: '#c9c7c0',
    un_observer: '#c9c7c0',
    partially_recognized: '#c9c7c0',
    disputed: '#dedcd6',
    dependency: '#dad8d2',
    other: '#efeeea',
  },
  sequential: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'],
  negative: ['#9a2a28', '#d0504c', '#f0928d'],
  positive: ['#86b6ef', '#2a78d6', '#104281'],
  flowExports: '#2a78d6',
  flowImports: '#eb6834',
};

const dark: MapPalette = {
  ocean: '#151514',
  border: '#151514',
  hover: '#a3a29b',
  selected: '#f0efec',
  hatch: '#8a8983',
  noData: '#45443f',
  status: {
    un_member: '#4a4944',
    un_observer: '#4a4944',
    partially_recognized: '#4a4944',
    disputed: '#2e2d2a',
    dependency: '#3a3935',
    other: '#232321',
  },
  sequential: ['#184f95', '#256abf', '#3987e5', '#86b6ef', '#cde2fb'],
  negative: ['#f0928d', '#d0504c', '#9a2a28'],
  positive: ['#1c5cab', '#3987e5', '#86b6ef'],
  flowExports: '#3987e5',
  flowImports: '#d95926',
};

export function paletteFor(darkMode: boolean): MapPalette {
  return darkMode ? dark : light;
}
