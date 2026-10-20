import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CHAIN_BY_ID, CHAIN_FILES, type ChainNote, type Citation } from '../../shared/chains';
import type { DatasetMeta } from '../../shared/types';
import { readCountryIds, today, writeDataset } from '../lib/write';

interface SourceFile {
  sources: Record<string, Citation>;
  notes: (Omit<ChainNote, 'sources'> & { sources: string[] })[];
}

/** Resolves source keys and checks every note: known chain, stage and countries, at least one source. */
export function validateNotes(file: SourceFile, validIds: ReadonlySet<string>): ChainNote[] {
  const problems: string[] = [];
  const notes = file.notes.map((n, i) => {
    const where = `note ${i + 1} (${n.chain}/${n.stage})`;
    const chain = CHAIN_BY_ID[n.chain];
    if (!chain) problems.push(`${where}: unknown chain`);
    else if (!chain.stages.some((s) => s.id === n.stage)) problems.push(`${where}: unknown stage`);
    for (const c of n.countries)
      if (!validIds.has(c)) problems.push(`${where}: unknown country ${c}`);
    if (!n.sources.length) problems.push(`${where}: no source`);
    const sources = n.sources.map((key) => {
      const s = file.sources[key];
      if (!s) problems.push(`${where}: unknown source ${key}`);
      return s!;
    });
    if (!n.text.trim()) problems.push(`${where}: empty text`);
    return { ...n, sources };
  });
  if (problems.length) throw new Error(`Invalid chain notes:\n  ${problems.join('\n  ')}`);
  return notes;
}

export async function runChainNotes(): Promise<void> {
  console.log('chains: curated production-chain notes');
  const file = JSON.parse(
    await readFile(path.resolve(import.meta.dirname, 'notes.source.json'), 'utf8'),
  ) as SourceFile;
  const notes = validateNotes(file, await readCountryIds());
  const meta: DatasetMeta = {
    id: 'chain-notes',
    title: 'Production-chain notes',
    source: 'Curated from peer-reviewed research and reports; each note cites its sources',
    sourceUrl:
      'https://github.com/alininium/world-economic-map/blob/main/pipeline/chains/notes.source.json',
    license: 'Notes: project text; cited works belong to their authors',
    retrievedAt: today(),
    dataYear: null,
    notes: `${notes.length} notes from ${Object.keys(file.sources).length} sources.`,
  };
  await writeDataset(CHAIN_FILES.notes, meta, notes);
}
