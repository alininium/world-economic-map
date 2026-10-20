/**
 * Production chains: each is a sequence of stages, and each stage is represented in trade data
 * by HS codes. Trade gives every country a measurable role per stage (net supplier or net
 * dependent); curated notes, each citing published research, describe the key players.
 *
 * HS codes are proxies: trade shows where goods cross borders, not where value is added or
 * which firms control production, and some stages (chip design, R&D) leave no customs trace.
 */
import type { Observation } from './indicators';

export type StagePosition = 'upstream' | 'midstream' | 'downstream';

export const POSITION_LABELS: Record<StagePosition, string> = {
  upstream: 'Upstream inputs',
  midstream: 'Processing',
  downstream: 'Downstream output',
};

export interface ChainStage {
  id: string;
  label: string;
  position: StagePosition;
  /** Empty for stages that leave no customs trace (design, IP). */
  hs: string[];
  hsLabel: string;
}

export interface ChainDef {
  id: string;
  label: string;
  description: string;
  stages: ChainStage[];
}

export const CHAINS: readonly ChainDef[] = [
  {
    id: 'semiconductors',
    label: 'Semiconductors',
    description: 'From silicon and fabrication tools to chips and the devices built around them.',
    stages: [
      {
        id: 'design',
        label: 'Design, IP and tools',
        position: 'upstream',
        hs: [],
        hsLabel: '',
      },
      {
        id: 'materials',
        label: 'Silicon and wafers',
        position: 'upstream',
        hs: ['280461', '381800'],
        hsLabel: 'silicon ≥99.99% (280461), doped wafers (381800)',
      },
      {
        id: 'equipment',
        label: 'Fabrication equipment',
        position: 'upstream',
        hs: ['8486'],
        hsLabel: 'machines for semiconductor and wafer manufacture (8486)',
      },
      {
        id: 'chips',
        label: 'Integrated circuits',
        position: 'midstream',
        hs: ['8542'],
        hsLabel: 'electronic integrated circuits (8542)',
      },
      {
        id: 'devices',
        label: 'Computers and phones',
        position: 'downstream',
        hs: ['8471', '8517'],
        hsLabel: 'computers (8471), telephone and network equipment (8517)',
      },
    ],
  },
  {
    id: 'batteries',
    label: 'Batteries and EVs',
    description: 'From battery minerals to lithium-ion cells and electric cars.',
    stages: [
      {
        id: 'minerals',
        label: 'Battery minerals',
        position: 'upstream',
        hs: ['283691', '282520', '2605', '2604', '250410'],
        hsLabel:
          'lithium carbonate (283691), lithium hydroxide (282520), cobalt ores (2605), nickel ores (2604), natural graphite (250410)',
      },
      {
        id: 'cells',
        label: 'Lithium-ion batteries',
        position: 'midstream',
        hs: ['850760'],
        hsLabel: 'lithium-ion accumulators (850760)',
      },
      {
        id: 'evs',
        label: 'Electric cars',
        position: 'downstream',
        hs: ['870380'],
        hsLabel: 'cars with only an electric motor (870380)',
      },
    ],
  },
  {
    id: 'steel',
    label: 'Steel',
    description: 'From iron ore and coking coal to steel and steel products.',
    stages: [
      {
        id: 'ore',
        label: 'Iron ore and coking coal',
        position: 'upstream',
        hs: ['2601', '270112'],
        hsLabel: 'iron ores (2601), bituminous coal (270112)',
      },
      {
        id: 'crude',
        label: 'Iron and semi-finished steel',
        position: 'midstream',
        hs: ['7201', '7206', '7207', '7224'],
        hsLabel: 'pig iron (7201), ingots and semi-finished steel (7206, 7207, 7224)',
      },
      {
        id: 'products',
        label: 'Rolled steel and tubes',
        position: 'downstream',
        hs: ['7208', '7209', '7210', '7213', '7214', '7304', '7306', '7308'],
        hsLabel:
          'flat-rolled steel (7208–7210), bars and rods (7213, 7214), tubes (7304, 7306), structures (7308)',
      },
    ],
  },
  {
    id: 'pharmaceuticals',
    label: 'Pharmaceuticals',
    description: 'From chemical ingredients to bulk and packaged medicines.',
    stages: [
      {
        id: 'ingredients',
        label: 'Active ingredients (proxy)',
        position: 'upstream',
        hs: ['2933', '2937', '2941'],
        hsLabel:
          'heterocyclic compounds (2933), hormones (2937), antibiotics (2941); APIs have no HS code of their own',
      },
      {
        id: 'bulk',
        label: 'Medicines in bulk',
        position: 'midstream',
        hs: ['3003'],
        hsLabel: 'medicaments not in measured doses (3003)',
      },
      {
        id: 'medicines',
        label: 'Packaged medicines and vaccines',
        position: 'downstream',
        hs: ['3004', '3002'],
        hsLabel: 'medicaments in measured doses (3004), blood products and vaccines (3002)',
      },
    ],
  },
  {
    id: 'food',
    label: 'Grain and fertiliser',
    description: 'From fertiliser inputs to wheat and wheat-based food.',
    stages: [
      {
        id: 'fertiliser',
        label: 'Fertilisers',
        position: 'upstream',
        hs: ['3102', '3104', '3105'],
        hsLabel: 'nitrogenous (3102), potassic (3104) and mixed (3105) fertilisers',
      },
      {
        id: 'wheat',
        label: 'Wheat',
        position: 'midstream',
        hs: ['1001'],
        hsLabel: 'wheat and meslin (1001)',
      },
      {
        id: 'flour',
        label: 'Flour and bakery products',
        position: 'downstream',
        hs: ['1101', '1905'],
        hsLabel: 'wheat flour (1101), bread and bakery products (1905)',
      },
    ],
  },
];

export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c])) as Record<
  string,
  ChainDef
>;

export interface Citation {
  title: string;
  authors: string;
  year: number;
  venue: string;
  url: string;
}

/** A sourced statement about the role of named countries at one stage of a chain. */
export interface ChainNote {
  chain: string;
  stage: string;
  /** Country ids the statement is about. */
  countries: string[];
  text: string;
  /** Year the statement refers to, when the source gives one. */
  asOf?: number;
  sources: Citation[];
}

/** Exports and imports of one stage's HS codes per country (UN Comtrade, partner World). */
export interface StageTrade {
  exports: Record<string, Observation>;
  imports: Record<string, Observation>;
}

/** chain id → stage id → trade. */
export type ChainTradeTable = Record<string, Record<string, StageTrade>>;

export const CHAIN_FILES = {
  notes: 'chains/notes.json',
  trade: 'chains/trade.json',
} as const;
