import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Dataset, DatasetMeta, Manifest } from '../../shared/types';

export const DATA_DIR = path.resolve(import.meta.dirname, '../../data');

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Writes data/<relPath> as { meta, data } and records it in data/manifest.json. */
export async function writeDataset<T>(relPath: string, meta: DatasetMeta, data: T): Promise<void> {
  await writeRaw(relPath, { meta, data } satisfies Dataset<T>);
  await recordInManifest(relPath, meta);
}

/** Writes a file whose format is fixed by others (e.g. TopoJSON); provenance goes in the manifest. */
export async function writeRaw(relPath: string, value: unknown): Promise<void> {
  const file = path.join(DATA_DIR, relPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value) + '\n');
  console.log(`  wrote data/${relPath}`);
}

export async function recordInManifest(relPath: string, meta: DatasetMeta): Promise<void> {
  const file = path.join(DATA_DIR, 'manifest.json');
  let manifest: Manifest = { generatedAt: today(), datasets: [] };
  try {
    manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest;
  } catch {
    // first dataset
  }
  manifest.datasets = manifest.datasets.filter((d) => d.path !== relPath);
  manifest.datasets.push({ path: relPath, meta });
  manifest.datasets.sort((a, b) => a.path.localeCompare(b.path));
  manifest.generatedAt = today();
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}

/** Ids of every entity in data/countries.json; run the geo step first. */
export async function readCountryIds(): Promise<Set<string>> {
  const file = path.join(DATA_DIR, 'countries.json');
  const parsed = JSON.parse(await readFile(file, 'utf8')) as Dataset<{ id: string }[]>;
  return new Set(parsed.data.map((c) => c.id));
}
