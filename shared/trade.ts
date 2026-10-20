/** Trade data shapes shared by the pipeline (writer) and the app (reader). */

export interface TradeEntry {
  /** HS code for products; partner ISO3 or Comtrade code for partners. */
  code: string;
  name: string;
  /** US dollars: exports valued FOB, imports CIF, as reported. */
  value: number;
  /** Share of the reporter's total for this flow, 0–1. */
  share: number;
  /** For partners: the map entity this partner is, when it is one (enables flow lines). */
  partnerId?: string | null;
}

export interface TradeSide {
  /** Total with the world; null if the reporter did not report this flow for the year. */
  total: number | null;
  products: TradeEntry[];
  partners: TradeEntry[];
}

export interface TradeProfile {
  /** The reporter's latest year with data; both flows use the same year. */
  year: number;
  exports: TradeSide;
  imports: TradeSide;
}

/** Codes in the trade summary SeriesTable. */
export const TRADE_SERIES = {
  exportsTotal: 'EXPORTS_TOTAL',
  importsTotal: 'IMPORTS_TOTAL',
  exportConcentration: 'EXPORT_HHI_HS4',
} as const;

export const TRADE_SUMMARY_PATH = 'trade/summary.json';
export const tradeProfilePath = (id: string) => `trade/by-country/${id}.json`;
