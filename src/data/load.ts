import type { Country, Dataset, Manifest } from '../../shared/types';
import type { Topology } from 'topojson-specification';

async function getJson<T>(relPath: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${relPath}`);
  if (!res.ok) throw new Error(`Could not load ${relPath} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export interface BaseData {
  manifest: Manifest;
  countries: Dataset<Country[]>;
  topo: Topology;
}

/** Loads the datasets every view needs: the country list and its boundaries. */
export async function loadBaseData(): Promise<BaseData> {
  const [manifest, countries, topo] = await Promise.all([
    getJson<Manifest>('manifest.json'),
    getJson<Dataset<Country[]>>('countries.json'),
    getJson<Topology>('geo/countries.topo.json'),
  ]);
  return { manifest, countries, topo };
}
