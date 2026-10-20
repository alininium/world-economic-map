import { describe, expect, it } from 'vitest';
import { validateNotes } from './notes';

const citation = { title: 'T', authors: 'A', year: 2024, venue: 'V', url: 'https://example.org' };
const ids = new Set(['CHN', 'TWN']);

describe('validateNotes', () => {
  it('resolves source keys into citations', () => {
    const notes = validateNotes(
      {
        sources: { a: citation },
        notes: [
          {
            chain: 'semiconductors',
            stage: 'chips',
            countries: ['TWN'],
            text: 'x',
            sources: ['a'],
          },
        ],
      },
      ids,
    );
    expect(notes[0]?.sources).toEqual([citation]);
  });

  it('rejects notes without sources, or with unknown chains, stages, countries or sources', () => {
    expect(() =>
      validateNotes(
        {
          sources: {},
          notes: [
            { chain: 'semiconductors', stage: 'chips', countries: ['TWN'], text: 'x', sources: [] },
            { chain: 'nope', stage: 'chips', countries: ['CHN'], text: 'x', sources: ['a'] },
            { chain: 'steel', stage: 'nope', countries: ['XXX'], text: 'x', sources: ['b'] },
          ],
        },
        ids,
      ),
    ).toThrow(/no source[\s\S]*unknown chain[\s\S]*unknown stage[\s\S]*unknown country XXX/);
  });

  it('accepts the committed notes file', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const file = JSON.parse(
      await readFile(path.resolve(import.meta.dirname, 'notes.source.json'), 'utf8'),
    );
    const countries = JSON.parse(
      await readFile(path.resolve(import.meta.dirname, '../../data/countries.json'), 'utf8'),
    ) as { data: { id: string }[] };
    const notes = validateNotes(file, new Set(countries.data.map((c) => c.id)));
    expect(notes.length).toBeGreaterThan(10);
    expect(notes.every((n) => n.sources.length > 0)).toBe(true);
  });
});
