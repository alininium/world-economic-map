/**
 * Strategic commodities and where each measure comes from. The pipeline reads this to know
 * what to extract; the app reads it to build the commodity view and the panel's resources
 * section. A measure with no source configured is shown as unavailable, never estimated.
 */
import type { Observation } from './indicators';

export type CommodityCategory = 'critical_mineral' | 'rare_earths' | 'energy' | 'agriculture';

/** Production of the raw material, processing of it, known reserves, and trade. */
export type Measure = 'production' | 'refining' | 'reserves' | 'exports' | 'imports';

export const MEASURES: readonly Measure[] = [
  'production',
  'refining',
  'reserves',
  'exports',
  'imports',
];

export const MEASURE_LABELS: Record<Measure, string> = {
  production: 'Production',
  refining: 'Refining / processing',
  reserves: 'Reserves',
  exports: 'Exports',
  imports: 'Imports',
};

export const CATEGORY_LABELS: Record<CommodityCategory, string> = {
  critical_mineral: 'Critical minerals',
  rare_earths: 'Rare earths',
  energy: 'Energy',
  agriculture: 'Agricultural staples',
};

export interface UsgsRef {
  /** Matches the commodity name in the USGS MCS world data (case-insensitive). */
  commodity: RegExp;
  /**
   * Match the TYPE of the rows for mine production and for refinery/processing output. When
   * several distinct TYPE values match, only the first in the file is used: different series
   * (e.g. ore vs metal content) are never added together.
   */
  mine?: RegExp;
  refinery?: RegExp;
  /** USGS publishes reserves for this commodity. */
  reserves?: boolean;
}

export interface CommodityDef {
  id: string;
  label: string;
  category: CommodityCategory;
  description: string;
  usgs?: UsgsRef;
  /** Column in the OWID energy dataset (Energy Institute Statistical Review), in TWh. */
  energyColumn?: string;
  /** FAOSTAT item code (QCL domain), production in tonnes. */
  faoItem?: string;
  /** HS codes summed for exports and imports (UN Comtrade). */
  hs: string[];
  hsLabel: string;
  /** Explains a gap that no open source fills. */
  note?: string;
}

const mine = /mine production/i;

export const COMMODITIES: readonly CommodityDef[] = [
  {
    id: 'lithium',
    label: 'Lithium',
    category: 'critical_mineral',
    description: 'Battery cathodes for EVs and grid storage.',
    usgs: { commodity: /^lithium$/i, mine, reserves: true },
    hs: ['283691', '282520'],
    hsLabel: 'lithium carbonate (283691), lithium oxide and hydroxide (282520)',
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    category: 'critical_mineral',
    description: 'Battery cathodes, superalloys.',
    usgs: { commodity: /^cobalt$/i, mine, refinery: /refinery/i, reserves: true },
    hs: ['2605', '810520'],
    hsLabel: 'cobalt ores (2605), unwrought cobalt (810520)',
  },
  {
    id: 'nickel',
    label: 'Nickel',
    category: 'critical_mineral',
    description: 'Stainless steel and battery cathodes.',
    usgs: { commodity: /^nickel$/i, mine, reserves: true },
    hs: ['2604', '7502'],
    hsLabel: 'nickel ores (2604), unwrought nickel (7502)',
  },
  {
    id: 'copper',
    label: 'Copper',
    category: 'critical_mineral',
    description: 'Electrification: grids, motors, EVs.',
    usgs: { commodity: /^copper$/i, mine, refinery: /refinery/i, reserves: true },
    hs: ['2603', '7403'],
    hsLabel: 'copper ores (2603), refined copper (7403)',
  },
  {
    id: 'graphite',
    label: 'Graphite (natural)',
    category: 'critical_mineral',
    description: 'Battery anodes, refractories.',
    usgs: { commodity: /^graphite/i, mine, reserves: true },
    hs: ['250410', '250490'],
    hsLabel: 'natural graphite (2504)',
  },
  {
    id: 'manganese',
    label: 'Manganese',
    category: 'critical_mineral',
    description: 'Steelmaking, battery cathodes.',
    usgs: { commodity: /^manganese$/i, mine, reserves: true },
    hs: ['2602'],
    hsLabel: 'manganese ores (2602)',
  },
  {
    id: 'rare_earths',
    label: 'Rare earths',
    category: 'rare_earths',
    description: 'Permanent magnets for EV motors, wind turbines, defence.',
    usgs: { commodity: /^rare earths?$/i, mine, reserves: true },
    hs: ['280530', '2846'],
    hsLabel: 'rare-earth metals (280530), rare-earth compounds (2846)',
  },
  {
    id: 'gallium',
    label: 'Gallium',
    category: 'critical_mineral',
    description: 'Semiconductors (GaN, GaAs), LEDs.',
    usgs: { commodity: /^gallium$/i, refinery: /primary production|refinery/i },
    hs: [],
    hsLabel: '',
    note: 'Trade is not shown: gallium shares HS code 811292 with germanium, indium and other metals, so no customs code isolates it.',
  },
  {
    id: 'germanium',
    label: 'Germanium',
    category: 'critical_mineral',
    description: 'Fibre optics, infrared optics, semiconductors.',
    usgs: { commodity: /^germanium$/i, refinery: /refinery|primary production/i },
    hs: [],
    hsLabel: '',
    note: 'Trade is not shown: germanium shares HS code 811292 with gallium, indium and other metals, so no customs code isolates it.',
  },
  {
    id: 'tungsten',
    label: 'Tungsten',
    category: 'critical_mineral',
    description: 'Cutting tools, defence, electronics.',
    usgs: { commodity: /^tungsten$/i, mine, reserves: true },
    hs: ['2611'],
    hsLabel: 'tungsten ores (2611)',
  },
  {
    id: 'platinum',
    label: 'Platinum',
    category: 'critical_mineral',
    description: 'Catalytic converters, hydrogen electrolysers and fuel cells, glass.',
    usgs: { commodity: /^platinum/i, mine: /mine production.*platinum/i, reserves: true },
    hs: ['711011', '711019'],
    hsLabel: 'platinum, unwrought or semi-manufactured (711011, 711019)',
    note: 'USGS publishes reserves for the platinum-group metals combined, so reserves are for all PGMs.',
  },
  {
    id: 'palladium',
    label: 'Palladium',
    category: 'critical_mineral',
    description: 'Catalytic converters, electronics.',
    usgs: { commodity: /^platinum/i, mine: /mine production.*palladium/i },
    hs: ['711021', '711029'],
    hsLabel: 'palladium, unwrought or semi-manufactured (711021, 711029)',
  },
  {
    id: 'bauxite',
    label: 'Bauxite',
    category: 'critical_mineral',
    description: 'Ore for alumina and aluminium.',
    usgs: { commodity: /^bauxite/i, mine, reserves: true },
    hs: ['2606'],
    hsLabel: 'aluminium ores (2606)',
  },
  {
    id: 'iron_ore',
    label: 'Iron ore',
    category: 'critical_mineral',
    description: 'Steelmaking.',
    // USGS gives both usable ore and iron content; use usable ore, the traded product.
    usgs: { commodity: /^iron ore$/i, mine: /mine production.*usable|usable ore/i, reserves: true },
    hs: ['2601'],
    hsLabel: 'iron ores (2601)',
  },
  {
    id: 'oil',
    label: 'Crude oil',
    category: 'energy',
    description: 'Transport fuels, petrochemicals.',
    energyColumn: 'oil_production',
    hs: ['2709'],
    hsLabel: 'crude petroleum (2709)',
    note: 'Reserves are not covered: the Energy Institute stopped publishing reserves data after 2020.',
  },
  {
    id: 'gas',
    label: 'Natural gas',
    category: 'energy',
    description: 'Power, heating, industry, fertiliser.',
    energyColumn: 'gas_production',
    hs: ['271111', '271121'],
    hsLabel: 'LNG (271111) and pipeline natural gas (271121)',
    note: 'Reserves are not covered: the Energy Institute stopped publishing reserves data after 2020.',
  },
  {
    id: 'coal',
    label: 'Coal',
    category: 'energy',
    description: 'Power generation, steelmaking (coking coal).',
    energyColumn: 'coal_production',
    hs: ['2701'],
    hsLabel: 'coal (2701)',
    note: 'Reserves are not covered: the Energy Institute stopped publishing reserves data after 2020.',
  },
  {
    id: 'uranium',
    label: 'Uranium',
    category: 'energy',
    description: 'Nuclear fuel.',
    hs: ['2612'],
    hsLabel: 'uranium and thorium ores (2612)',
    note: 'No open, machine-readable dataset of uranium production by country was found (the main compilations are the OECD-NEA/IAEA Red Book and the World Nuclear Association). Only trade is shown.',
  },
  {
    id: 'wheat',
    label: 'Wheat',
    category: 'agriculture',
    description: 'Staple grain.',
    faoItem: '15',
    hs: ['1001'],
    hsLabel: 'wheat and meslin (1001)',
  },
  {
    id: 'maize',
    label: 'Maize',
    category: 'agriculture',
    description: 'Feed, food, ethanol.',
    faoItem: '56',
    hs: ['1005'],
    hsLabel: 'maize (1005)',
  },
  {
    id: 'rice',
    label: 'Rice',
    category: 'agriculture',
    description: 'Staple grain.',
    faoItem: '27',
    hs: ['1006'],
    hsLabel: 'rice (1006)',
  },
  {
    id: 'soybeans',
    label: 'Soybeans',
    category: 'agriculture',
    description: 'Feed protein, vegetable oil.',
    faoItem: '236',
    hs: ['1201'],
    hsLabel: 'soya beans (1201)',
  },
];

export const COMMODITY_BY_ID = Object.fromEntries(COMMODITIES.map((c) => [c.id, c])) as Record<
  string,
  CommodityDef
>;

/** One measure of one commodity from one source. */
export interface MeasureTable {
  /** Unit as published, e.g. "metric tons", "TWh", "US dollars". */
  unit: string;
  /** Country id → latest observation. */
  values: Record<string, Observation>;
  /** The source's world total, used for shares; absent when the source has none. */
  world?: Observation;
  /** Explains what exactly is counted (e.g. "lithium content"). */
  note?: string;
}

/** What a resource source file holds: commodity id → measure → table. */
export type ResourceTable = Record<string, Partial<Record<Measure, MeasureTable>>>;

export const RESOURCE_FILES = {
  usgs: 'resources/usgs.json',
  energy: 'resources/energy.json',
  fao: 'resources/fao.json',
  trade: 'resources/trade.json',
} as const;
