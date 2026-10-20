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
 * Resolves each indicator per country: the first series (in catalogue order) that has a
 * value wins, so a fallback source only fills countries the primary source lacks.
 */
export function buildMacroIndex(tables: Partial<Record<SourceId, SeriesTable>>): MacroIndex {
  const index = {} as MacroIndex;
  for (const def of INDICATORS) {
    const byCountry: Record<string, Figure> = {};
    for (const { source, code } of def.series) {
      const series = tables[source]?.[code];
      if (!series) continue;
      for (const [id, obs] of Object.entries(series)) {
        byCountry[id] ??= { ...obs, source, code };
      }
    }
    index[def.key] = byCountry;
  }
  return index;
}

export const SOURCE_LABELS: Record<SourceId, string> = {
  worldbank: 'World Bank WDI',
  imf: 'IMF WEO',
};

export function sourceLink(source: SourceId, code: string, iso2: string | null): string {
  if (source === 'worldbank') {
    return `https://data.worldbank.org/indicator/${code}${iso2 ? `?locations=${iso2}` : ''}`;
  }
  return `https://www.imf.org/external/datamapper/${code}`;
}
