import type { CurrencyTable, SeriesTable, SourceId } from '../../shared/indicators';
import type { Country, Dataset, DatasetMeta, Manifest } from '../../shared/types';
import type { Topology } from 'topojson-specification';

async function getJson<T>(relPath: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${relPath}`);
  if (!res.ok) throw new Error(`Could not load ${relPath} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/** Loads a dataset only if the manifest lists it, i.e. the pipeline has produced it. */
async function getListed<T>(manifest: Manifest, relPath: string): Promise<Dataset<T> | null> {
  if (!manifest.datasets.some((d) => d.path === relPath)) return null;
  return getJson<Dataset<T>>(relPath);
}

export interface AppData {
  manifest: Manifest;
  countries: Dataset<Country[]>;
  topo: Topology;
  /** Macro source tables; a source is absent until `npm run data:refresh` has fetched it. */
  macro: Partial<Record<SourceId, Dataset<SeriesTable>>>;
  currencies: Dataset<CurrencyTable> | null;
}

export async function loadAppData(): Promise<AppData> {
  const manifest = await getJson<Manifest>('manifest.json');
  const [countries, topo, worldbank, imf, currencies] = await Promise.all([
    getJson<Dataset<Country[]>>('countries.json'),
    getJson<Topology>('geo/countries.topo.json'),
    getListed<SeriesTable>(manifest, 'macro/worldbank.json'),
    getListed<SeriesTable>(manifest, 'macro/imf.json'),
    getListed<CurrencyTable>(manifest, 'currencies.json'),
  ]);
  const macro: AppData['macro'] = {};
  if (worldbank) macro.worldbank = worldbank;
  if (imf) macro.imf = imf;
  return { manifest, countries, topo, macro, currencies };
}

export function metaFor(manifest: Manifest, relPath: string): DatasetMeta | undefined {
  return manifest.datasets.find((d) => d.path === relPath)?.meta;
}
