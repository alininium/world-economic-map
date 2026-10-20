import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BRIEFS_PATH, DATASET_CITATIONS, MAX_BRIEF_WORDS, type Brief } from '../../shared/briefs';
import type { Citation } from '../../shared/chains';
import type { DatasetMeta } from '../../shared/types';
import { readCountryIds, today, writeDataset } from '../lib/write';

export interface BriefsSourceFile {
  sources: Record<string, Citation>;
  briefs: (Omit<Brief, 'sources'> & { sources: string[] })[];
}

/** Resolves source keys and checks every brief: known country, once only, cited, not too long. */
export function validateBriefs(file: BriefsSourceFile, validIds: ReadonlySet<string>): Brief[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [key, s] of Object.entries(file.sources)) {
    if (key in DATASET_CITATIONS) problems.push(`source ${key}: shadows a built-in dataset key`);
    if (!/^https?:\/\//.test(s.url ?? '')) problems.push(`source ${key}: missing url`);
    if (!s.title?.trim() || !s.authors?.trim() || !Number.isInteger(s.year)) {
      problems.push(`source ${key}: needs title, authors and year`);
    }
  }
  const briefs = file.briefs.map((b) => {
    const where = `brief ${b.id}`;
    if (!validIds.has(b.id)) problems.push(`${where}: unknown country`);
    if (seen.has(b.id)) problems.push(`${where}: duplicate`);
    seen.add(b.id);
    const words = b.text.trim().split(/\s+/).filter(Boolean).length;
    if (!words) problems.push(`${where}: empty text`);
    if (words > MAX_BRIEF_WORDS) problems.push(`${where}: ${words} words (max ${MAX_BRIEF_WORDS})`);
    if (!b.sources.length) problems.push(`${where}: no source`);
    const sources = b.sources.map((key) => {
      const s = DATASET_CITATIONS[key] ?? file.sources[key];
      if (!s) problems.push(`${where}: unknown source ${key}`);
      return s!;
    });
    return { id: b.id, text: b.text.trim(), sources };
  });
  if (problems.length) throw new Error(`Invalid briefs:\n  ${problems.join('\n  ')}`);
  return briefs;
}

export async function runBriefs(): Promise<void> {
  console.log('briefs: curated country economy briefs');
  const file = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, 'briefs.source.json'), 'utf8'),
  ) as BriefsSourceFile;
  const briefs = validateBriefs(file, await readCountryIds());
  const meta: DatasetMeta = {
    id: 'briefs',
    title: 'Country economy briefs',
    source:
      "Written from this project's datasets and cited literature; each brief lists its sources",
    sourceUrl:
      'https://github.com/alininium/world-economic-map/blob/main/pipeline/briefs/briefs.source.json',
    license: 'Briefs: project text; cited works belong to their authors',
    retrievedAt: today(),
    dataYear: null,
    notes: `${briefs.length} briefs from ${Object.keys(file.sources).length} sources plus the project's datasets. Figures are as of the years stated in each brief.`,
  };
  await writeDataset(BRIEFS_PATH, meta, briefs);
}
