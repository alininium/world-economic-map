import { describe, expect, it } from 'vitest';
import type { ChainNote } from '../../shared/chains';
import { countryChainTrade, netTrade, notesAbout, notesFor } from './chains';

// Invented values; only the arithmetic and filtering are under test.
describe('netTrade', () => {
  it('nets exports against imports and orders by net position', () => {
    const r = netTrade({
      exports: { AAA: { value: 10, year: 2024 }, BBB: { value: 1, year: 2024 } },
      imports: { BBB: { value: 9, year: 2024 }, CCC: { value: 4, year: 2024 } },
    });
    expect(r.map((x) => [x.id, x.net])).toEqual([
      ['AAA', 10],
      ['CCC', -4],
      ['BBB', -8],
    ]);
  });

  it('leaves out countries whose flows are for different years', () => {
    const r = netTrade({
      exports: { AAA: { value: 10, year: 2024 } },
      imports: { AAA: { value: 9, year: 2022 } },
    });
    expect(r).toEqual([]);
  });
});

describe('countryChainTrade', () => {
  it('lists the country’s stages in catalogue order', () => {
    const rows = countryChainTrade(
      {
        steel: { ore: { exports: { AUS: { value: 5, year: 2024 } }, imports: {} } },
        semiconductors: { chips: { exports: {}, imports: { AUS: { value: 2, year: 2024 } } } },
      },
      'AUS',
    );
    expect(rows.map((r) => [r.chain, r.stage, r.net])).toEqual([
      ['semiconductors', 'chips', -2],
      ['steel', 'ore', 5],
    ]);
  });
});

describe('notes filters', () => {
  const note = (chain: string, stage: string, countries: string[]): ChainNote => ({
    chain,
    stage,
    countries,
    text: '',
    sources: [],
  });
  const notes = [note('steel', 'ore', ['AUS']), note('steel', 'crude', ['CHN', 'AUS'])];

  it('selects by chain and stage, or by country', () => {
    expect(notesFor(notes, 'steel', 'ore')).toHaveLength(1);
    expect(notesFor(notes, 'steel')).toHaveLength(2);
    expect(notesAbout(notes, 'CHN')).toHaveLength(1);
  });
});
