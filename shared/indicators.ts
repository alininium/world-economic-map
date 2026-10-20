/**
 * The macro indicators the app shows, and where each comes from. The pipeline reads this to
 * know what to download; the app reads it to label, format and colour the figures.
 *
 * Each indicator has a primary series and, where the IMF publishes a comparable one, a
 * fallback used only for countries the primary source does not cover (e.g. the World Bank
 * publishes nothing for Taiwan). Every figure keeps the source it came from.
 */

export type IndicatorKey =
  | 'gdp'
  | 'gdpPpp'
  | 'gdpGrowth'
  | 'gdpPerCapita'
  | 'gdpPerCapitaPpp'
  | 'inflation'
  | 'unemployment'
  | 'govDebt'
  | 'population'
  | 'tradeBalance'
  | 'exportConcentration'
  | 'fdiInflows'
  | 'fdiInflowsPct'
  | 'fdiOutflows'
  | 'fdiOutflowsPct';

export type Unit = 'usd' | 'intl_usd' | 'percent' | 'percent_gdp' | 'people' | 'index';

/** How a metric is coloured: magnitude (one hue) or signed around zero (two hues). */
export type ScaleKind = 'sequential' | 'diverging';

export type SourceId = 'worldbank' | 'imf' | 'comtrade';

export interface SeriesRef {
  source: SourceId;
  /** Indicator code in that source. */
  code: string;
  /** Multiplier from the source's published unit to the base unit (IMF publishes billions). */
  scale?: number;
}

export interface IndicatorDef {
  key: IndicatorKey;
  label: string;
  unit: Unit;
  scaleKind: ScaleKind;
  /** Offered as a choropleth metric. */
  choropleth: boolean;
  series: SeriesRef[];
  description: string;
  /** Panel section the figure belongs to (default: the macro snapshot). */
  section?: 'macro' | 'fdi';
  /** Keep a yearly history (World Bank series only) for the panel chart. */
  history?: boolean;
}

const wb = (code: string): SeriesRef => ({ source: 'worldbank', code });
const imf = (code: string, scale?: number): SeriesRef => ({ source: 'imf', code, scale });

export const INDICATORS: readonly IndicatorDef[] = [
  {
    key: 'gdp',
    label: 'GDP (nominal)',
    unit: 'usd',
    scaleKind: 'sequential',
    choropleth: true,
    series: [wb('NY.GDP.MKTP.CD'), imf('NGDPD', 1e9)],
    description: 'Gross domestic product at current prices, in US dollars.',
  },
  {
    key: 'gdpPpp',
    label: 'GDP (PPP)',
    unit: 'intl_usd',
    scaleKind: 'sequential',
    choropleth: true,
    series: [wb('NY.GDP.MKTP.PP.CD'), imf('PPPGDP', 1e9)],
    description: 'GDP at purchasing power parity, in current international dollars.',
  },
  {
    key: 'gdpGrowth',
    label: 'GDP growth',
    unit: 'percent',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('NY.GDP.MKTP.KD.ZG'), imf('NGDP_RPCH')],
    description: 'Annual change in real (constant-price) GDP.',
  },
  {
    key: 'gdpPerCapita',
    label: 'GDP per capita',
    unit: 'usd',
    scaleKind: 'sequential',
    choropleth: true,
    series: [wb('NY.GDP.PCAP.CD'), imf('NGDPDPC')],
    description: 'GDP divided by mid-year population, current US dollars.',
  },
  {
    key: 'gdpPerCapitaPpp',
    label: 'GDP per capita (PPP)',
    unit: 'intl_usd',
    scaleKind: 'sequential',
    choropleth: true,
    series: [wb('NY.GDP.PCAP.PP.CD'), imf('PPPPC')],
    description: 'GDP per capita at purchasing power parity, current international dollars.',
  },
  {
    key: 'inflation',
    label: 'Inflation',
    unit: 'percent',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('FP.CPI.TOTL.ZG'), imf('PCPIPCH')],
    description: 'Annual change in consumer prices (period average).',
  },
  {
    key: 'unemployment',
    label: 'Unemployment',
    unit: 'percent',
    scaleKind: 'sequential',
    choropleth: true,
    series: [wb('SL.UEM.TOTL.ZS'), imf('LUR')],
    description:
      'Share of the labour force without work (World Bank: modelled ILO estimate; IMF: national definitions).',
  },
  {
    key: 'govDebt',
    label: 'Government debt',
    unit: 'percent_gdp',
    scaleKind: 'sequential',
    choropleth: true,
    series: [imf('GGXWDG_NGDP')],
    description: 'General government gross debt as a share of GDP.',
  },
  {
    key: 'population',
    label: 'Population',
    unit: 'people',
    scaleKind: 'sequential',
    choropleth: false,
    series: [wb('SP.POP.TOTL'), imf('LP', 1e6)],
    description: 'Total mid-year population.',
  },
  {
    key: 'tradeBalance',
    label: 'Trade balance',
    unit: 'usd',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('NE.RSB.GNFS.CD')],
    description: 'Exports minus imports of goods and services, current US dollars.',
  },
  {
    key: 'exportConcentration',
    label: 'Export concentration',
    unit: 'index',
    scaleKind: 'sequential',
    choropleth: true,
    series: [{ source: 'comtrade', code: 'EXPORT_HHI_HS4' }],
    description:
      'Herfindahl–Hirschman index of export shares across HS 4-digit products, from UN Comtrade: 0 = spread over many products, 1 = a single product. Not normalized, so it differs from UNCTAD’s concentration index.',
  },
  {
    key: 'fdiInflows',
    label: 'FDI net inflows',
    unit: 'usd',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('BX.KLT.DINV.CD.WD')],
    section: 'fdi',
    history: true,
    description:
      'Net inflows of foreign direct investment (balance of payments), current US dollars. Negative when foreign investors withdraw more than they invest.',
  },
  {
    key: 'fdiInflowsPct',
    label: 'FDI net inflows (% of GDP)',
    unit: 'percent',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('BX.KLT.DINV.WD.GD.ZS')],
    section: 'fdi',
    description: 'Net FDI inflows as a share of GDP.',
  },
  {
    key: 'fdiOutflows',
    label: 'FDI net outflows',
    unit: 'usd',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('BM.KLT.DINV.CD.WD')],
    section: 'fdi',
    history: true,
    description:
      'Net outflows of foreign direct investment by residents (balance of payments), current US dollars.',
  },
  {
    key: 'fdiOutflowsPct',
    label: 'FDI net outflows (% of GDP)',
    unit: 'percent',
    scaleKind: 'diverging',
    choropleth: true,
    series: [wb('BM.KLT.DINV.WD.GD.ZS')],
    section: 'fdi',
    description: 'Net FDI outflows as a share of GDP.',
  },
];

export const INDICATOR_BY_KEY = Object.fromEntries(INDICATORS.map((d) => [d.key, d])) as Record<
  IndicatorKey,
  IndicatorDef
>;

/** All codes needed from one source, with their unit multipliers. */
export function seriesFor(source: SourceId): SeriesRef[] {
  const seen = new Map<string, SeriesRef>();
  for (const def of INDICATORS) {
    for (const s of def.series) if (s.source === source) seen.set(s.code, s);
  }
  return [...seen.values()];
}

export interface Observation {
  value: number;
  year: number;
}

/** What a macro source file holds: series code → country id → latest observation. */
export type SeriesTable = Record<string, Record<string, Observation>>;

export interface CurrencyInfo {
  code: string;
  name: string;
}

/** Country id → currencies in legal use (ISO 4217). */
export type CurrencyTable = Record<string, CurrencyInfo[]>;

/** Series code → country id → yearly observations, oldest first. */
export type HistoryTable = Record<string, Record<string, Observation[]>>;

export const WB_HISTORY_PATH = 'macro/worldbank-history.json';
