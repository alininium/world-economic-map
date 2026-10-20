/** Types shared by the data pipeline (which writes them) and the app (which reads them). */

/** Provenance attached to every dataset file under data/. */
export interface DatasetMeta {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  license: string;
  /** ISO date (YYYY-MM-DD) on which the pipeline downloaded the source. */
  retrievedAt: string;
  /** Year (or edition) the figures describe; null when not applicable. */
  dataYear: string | null;
  notes?: string;
}

export interface Dataset<T> {
  meta: DatasetMeta;
  data: T;
}

/**
 * How an entity is treated on the map:
 * - un_member / un_observer: sovereign states, ranked and compared.
 * - partially_recognized: shown as its own entity with a badge (Taiwan, Kosovo).
 * - disputed: drawn hatched, never ranked (Western Sahara, Siachen Glacier).
 * - dependency: own data where it exists, kept out of sovereign rankings.
 * - other: drawn for context only (Antarctica).
 */
export type CountryStatus =
  'un_member' | 'un_observer' | 'partially_recognized' | 'disputed' | 'dependency' | 'other';

export type LngLat = [number, number];
/** [west, south, east, north]; east may exceed 180 when the shape crosses the antimeridian. */
export type BBox = [number, number, number, number];

export interface Country {
  /** Stable key: ISO 3166-1 alpha-3 where one exists (XKX for Kosovo), else the Natural Earth code. */
  id: string;
  iso3: string | null;
  iso2: string | null;
  name: string;
  formalName: string | null;
  status: CountryStatus;
  /** id of the sovereign state for dependencies; null otherwise. */
  sovereign: string | null;
  region: string | null;
  subregion: string | null;
  /** Point used for labels, small-country markers and flow lines. */
  label: LngLat;
  bbox: BBox;
  /** Too small to click as a polygon at world zoom; the map adds a marker. */
  tiny: boolean;
  /** Extra names for search (other languages, alternative spellings). */
  aliases: string[];
}

export interface ManifestEntry {
  path: string;
  meta: DatasetMeta;
}

export interface Manifest {
  generatedAt: string;
  datasets: ManifestEntry[];
}
