import {
  COMMODITIES,
  MEASURES,
  type Measure,
  type MeasureTable,
  type ResourceTable,
} from '../../shared/commodities';
import type { Dataset, DatasetMeta } from '../../shared/types';

export interface ResourceSeries {
  table: MeasureTable;
  meta: DatasetMeta;
}

/** Commodity id → measure → the series and the dataset it came from. */
export type ResourceIndex = Record<string, Partial<Record<Measure, ResourceSeries>>>;

/** Merges resource source files; when two sources cover the same measure the first wins. */
export function buildResourceIndex(files: readonly Dataset<ResourceTable>[]): ResourceIndex {
  const index: ResourceIndex = {};
  for (const file of files) {
    for (const [commodity, measures] of Object.entries(file.data)) {
      for (const m of MEASURES) {
        const table = measures[m];
        if (!table) continue;
        (index[commodity] ??= {})[m] ??= { table, meta: file.meta };
      }
    }
  }
  return index;
}

export interface Ranked {
  id: string;
  value: number;
  year: number;
  /** Share of the world total; null when the source has none for the same year. */
  share: number | null;
  rank: number;
}

/** Countries ordered by value, with rank and world share. */
export function ranking(table: MeasureTable, include?: (id: string) => boolean): Ranked[] {
  return Object.entries(table.values)
    .filter(([id, o]) => o.value > 0 && (!include || include(id)))
    .sort((a, b) => b[1].value - a[1].value)
    .map(([id, o], i) => ({
      id,
      value: o.value,
      year: o.year,
      share: table.world && table.world.year === o.year && table.world.value > 0 ? o.value / table.world.value : null,
      rank: i + 1,
    }));
}

export interface CountryResource {
  commodity: string;
  measure: Measure;
  value: number;
  year: number;
  unit: string;
  share: number | null;
  rank: number;
  of: number;
}

/**
 * What a country produces, refines, holds or trades, across all commodities, in catalogue
 * order. Ranks are among sovereign states and the country itself.
 */
export function countryResources(
  index: ResourceIndex,
  id: string,
  isRanked: (id: string) => boolean,
): CountryResource[] {
  const out: CountryResource[] = [];
  for (const c of COMMODITIES) {
    for (const m of MEASURES) {
      const series = index[c.id]?.[m];
      if (!series?.table.values[id]) continue;
      const list = ranking(series.table, (x) => x === id || isRanked(x));
      const me = list.find((r) => r.id === id);
      if (!me) continue;
      out.push({
        commodity: c.id,
        measure: m,
        value: me.value,
        year: me.year,
        unit: series.table.unit,
        share: me.share,
        rank: me.rank,
        of: list.length,
      });
    }
  }
  return out;
}
