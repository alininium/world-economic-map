import { CHAINS, type ChainNote, type ChainTradeTable, type StageTrade } from '../../shared/chains';

export interface NetTrade {
  id: string;
  exports: number;
  imports: number;
  /** Exports minus imports, same year only. */
  net: number;
  year: number;
}

/** Net trade per country for one stage; countries whose flows are for different years are left out. */
export function netTrade(stage: StageTrade): NetTrade[] {
  const ids = new Set([...Object.keys(stage.exports), ...Object.keys(stage.imports)]);
  const out: NetTrade[] = [];
  for (const id of ids) {
    const x = stage.exports[id];
    const m = stage.imports[id];
    const year = x?.year ?? m!.year;
    if (x && m && x.year !== m.year) continue;
    out.push({ id, exports: x?.value ?? 0, imports: m?.value ?? 0, net: (x?.value ?? 0) - (m?.value ?? 0), year });
  }
  return out.sort((a, b) => b.net - a.net);
}

export interface CountryStageRole extends NetTrade {
  chain: string;
  stage: string;
}

/** The country's net position in every stage that has trade data, in catalogue order. */
export function countryChainTrade(table: ChainTradeTable, id: string): CountryStageRole[] {
  const out: CountryStageRole[] = [];
  for (const chain of CHAINS) {
    for (const stage of chain.stages) {
      const t = table[chain.id]?.[stage.id];
      const mine = t && netTrade(t).find((r) => r.id === id);
      if (mine) out.push({ ...mine, chain: chain.id, stage: stage.id });
    }
  }
  return out;
}

export const notesFor = (notes: readonly ChainNote[], chain: string, stage?: string) =>
  notes.filter((n) => n.chain === chain && (!stage || n.stage === stage));

export const notesAbout = (notes: readonly ChainNote[], id: string) =>
  notes.filter((n) => n.countries.includes(id) || n.dependents?.includes(id));

/** How a note describes a country: as a producer/supplier, or as relying on others. */
export const roleIn = (note: ChainNote, id: string): 'supplier' | 'dependent' | null =>
  note.countries.includes(id) ? 'supplier' : note.dependents?.includes(id) ? 'dependent' : null;
