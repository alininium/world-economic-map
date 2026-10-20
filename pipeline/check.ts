/**
 * Sanity checks over everything listed in data/manifest.json: files exist and parse, carry
 * provenance, hold data, and only reference known country ids with finite numbers.
 * `npm run data:check`; exits non-zero on any problem.
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Manifest } from '../shared/types';
import { DATA_DIR } from './lib/write';

const ID = /^[A-Z][A-Z0-9]{1,3}$/;

/** Walks a dataset's data and reports country-keyed values that are unknown or not finite. */
export function checkValues(data: unknown, ids: ReadonlySet<string>, where: string): string[] {
  const problems: string[] = [];
  const walk = (node: unknown, trail: string) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${trail}[${i}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      // Country-keyed maps: their keys look like ids and their values are observations.
      if (ID.test(key) && value && typeof value === 'object' && 'value' in value) {
        if (!ids.has(key)) problems.push(`${where}: unknown country id ${key} at ${trail}`);
        const v = (value as { value: unknown }).value;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          problems.push(`${where}: non-finite value for ${key} at ${trail}`);
        }
        continue;
      }
      walk(value, `${trail}.${key}`);
    }
  };
  walk(data, '');
  return problems;
}

export function checkMeta(meta: Record<string, unknown> | undefined, where: string): string[] {
  if (!meta) return [`${where}: no meta`];
  return ['source', 'sourceUrl', 'license', 'retrievedAt']
    .filter((k) => typeof meta[k] !== 'string' || !(meta[k] as string).length)
    .map((k) => `${where}: meta.${k} missing`);
}

async function main(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(path.join(DATA_DIR, 'manifest.json'), 'utf8'),
  ) as Manifest;
  const countries = JSON.parse(await readFile(path.join(DATA_DIR, 'countries.json'), 'utf8')) as {
    data: { id: string }[];
  };
  const ids = new Set(countries.data.map((c) => c.id));
  const problems: string[] = [];
  for (const entry of manifest.datasets) {
    problems.push(...checkMeta(entry.meta as unknown as Record<string, unknown>, entry.path));
    const file = path.join(DATA_DIR, entry.path);
    if (entry.path.endsWith('/')) {
      // A directory of per-country files.
      try {
        if (!(await stat(file)).isDirectory()) problems.push(`${entry.path}: not a directory`);
      } catch {
        problems.push(`${entry.path}: missing`);
      }
      continue;
    }
    let parsed: { meta?: Record<string, unknown>; data?: unknown; type?: string };
    try {
      parsed = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      problems.push(`${entry.path}: ${(err as Error).message}`);
      continue;
    }
    if (parsed.type === 'Topology') continue; // TopoJSON: provenance lives in the manifest
    problems.push(...checkMeta(parsed.meta, entry.path));
    const empty =
      parsed.data === undefined ||
      (Array.isArray(parsed.data) && parsed.data.length === 0) ||
      (typeof parsed.data === 'object' && parsed.data !== null && !Object.keys(parsed.data).length);
    if (empty) problems.push(`${entry.path}: no data`);
    problems.push(...checkValues(parsed.data, ids, entry.path));
  }
  if (problems.length) {
    console.error(`${problems.length} problem(s):\n  ${problems.slice(0, 50).join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log(`data:check: ${manifest.datasets.length} datasets OK`);
  }
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) await main();
