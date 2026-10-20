import type { CurrencyTable, SeriesTable, SourceId } from '../../shared/indicators';
import { TRADE_SUMMARY_PATH, tradeProfilePath, type TradeProfile } from '../../shared/trade';
import type { Country, Dataset, DatasetMeta, Manifest } from '../../shared/types';
import type { Topology } from 'topojson-specification';

async function getJson<T>(relPath: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${relPath}`);
  if (!res.ok) throw new Error(`Could not load ${relPath} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/**
 * Loads an optional dataset if the manifest lists it (the pipeline has produced it). A broken
 * optional file is logged and treated as not loaded rather than taking the whole app down.
 */
async function getListed<T>(manifest: Manifest, relPath: string): Promise<Dataset<T> | null> {
  if (!metaFor(manifest, relPath)) return null;
  try {
    return await getJson<Dataset<T>>(relPath);
  } catch (err) {
    console.warn(`Skipping ${relPath}:`, err);
    return null;
  }
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
  // Required files start at once; only the optional ones wait for the manifest.
  const required = Promise.all([
    getJson<Dataset<Country[]>>('countries.json'),
    getJson<Topology>('geo/countries.topo.json'),
  ]);
  const manifest = await getJson<Manifest>('manifest.json');
  const [[countries, topo], worldbank, imf, comtrade, currencies] = await Promise.all([
    required,
    getListed<SeriesTable>(manifest, 'macro/worldbank.json'),
    getListed<SeriesTable>(manifest, 'macro/imf.json'),
    getListed<SeriesTable>(manifest, TRADE_SUMMARY_PATH),
    getListed<CurrencyTable>(manifest, 'currencies.json'),
  ]);
  const macro: AppData['macro'] = {};
  if (worldbank) macro.worldbank = worldbank;
  if (imf) macro.imf = imf;
  if (comtrade) macro.comtrade = comtrade;
  return { manifest, countries, topo, macro, currencies };
}

export function metaFor(manifest: Manifest, relPath: string): DatasetMeta | undefined {
  return manifest.datasets.find((d) => d.path === relPath)?.meta;
}

/**
 * Loads one country's trade profile. Resolves to null when the pipeline has produced no
 * profiles, or none for this country (it did not report to UN Comtrade recently). Rejects on
 * network or server errors, so the UI can offer a retry instead of claiming there is no data.
 */
export async function loadTradeProfile(
  manifest: Manifest,
  id: string,
): Promise<TradeProfile | null> {
  if (!metaFor(manifest, 'trade/by-country/')) return null;
  const res = await fetch(`${import.meta.env.BASE_URL}${tradeProfilePath(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // The dev server answers unknown paths with index.html instead of a 404.
  if (!res.headers.get('content-type')?.includes('json')) return null;
  return (await res.json()) as TradeProfile;
}
