import type { CountryStatus } from '../../shared/types';

export interface MapPalette {
  ocean: string;
  border: string;
  hover: string;
  selected: string;
  hatch: string;
  status: Record<CountryStatus, string>;
}

const light: MapPalette = {
  ocean: '#dfe8ef',
  border: '#ffffff',
  hover: '#f2b544',
  selected: '#d9480f',
  hatch: '#8a8f98',
  status: {
    un_member: '#b9c3cc',
    un_observer: '#b9c3cc',
    partially_recognized: '#b9c3cc',
    disputed: '#d6d9dd',
    dependency: '#d3d8dd',
    other: '#eef1f4',
  },
};

const dark: MapPalette = {
  ocean: '#0f1720',
  border: '#0f1720',
  hover: '#f2b544',
  selected: '#ff8a4c',
  hatch: '#7d8590',
  status: {
    un_member: '#3a4654',
    un_observer: '#3a4654',
    partially_recognized: '#3a4654',
    disputed: '#262e38',
    dependency: '#2c3540',
    other: '#1b222b',
  },
};

export function paletteFor(darkMode: boolean): MapPalette {
  return darkMode ? dark : light;
}
