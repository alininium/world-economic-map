import type { Country } from '../../shared/types';
import {
  INDICATORS,
  type IndicatorKey,
  type SeriesTable,
  type SourceId,
} from '../../shared/indicators';

export interface Figure {
  value: number;
  year: number;
  source: SourceId;
  /** Series code in that source, for linking to the original. */
  code: string;
}

export type MacroIndex = Record<IndicatorKey, Record<string, Figure>>;

/**
 * A fallback figure replaces the primary one only when it is at least this many years newer;
 * otherwise the primary source is kept for consistency across countries.
 */
export const FALLBACK_NEWER_BY = 3;

/**
 * Resolves each indicator per country: the first series (in catalogue order) that has a
 * value wins, so a fallback source fills countries the primary source lacks, and replaces a
 * primary figure only when that figure is FALLBACK_NEWER_BY or more years older.
 */
export function buildMacroIndex(tables: Partial<Record<SourceId, SeriesTable>>): MacroIndex {
  const index = {} as MacroIndex;
  for (const def of INDICATORS) {
    const byCountry: Record<string, Figure> = {};
    for (const { source, code } of def.series) {
      const series = tables[source]?.[code];
      if (!series) continue;
      for (const [id, obs] of Object.entries(series)) {
        const current = byCountry[id];
        if (!current || obs.year - current.year >= FALLBACK_NEWER_BY) {
          byCountry[id] = { ...obs, source, code };
        }
      }
    }
    index[def.key] = byCountry;
  }
  return index;
}

export const SOURCE_LABELS: Record<SourceId, string> = {
  worldbank: 'World Bank WDI',
  imf: 'IMF WEO',
  comtrade: 'UN Comtrade',
};

/** Link to the series on the source's own site, scoped to the country where the site allows. */
export function sourceLink(
  source: SourceId,
  code: string,
  country: Pick<Country, 'id' | 'iso2'>,
): string {
  if (source === 'worldbank') {
    const loc = country.iso2 ? `?locations=${country.iso2}` : '';
    return `https://data.worldbank.org/indicator/${code}${loc}`;
  }
  if (source === 'comtrade') return 'https://comtradeplus.un.org/';
  return `https://www.imf.org/external/datamapper/${code}@WEO/${country.id}`;
}
