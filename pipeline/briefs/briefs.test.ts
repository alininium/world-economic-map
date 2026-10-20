import { describe, expect, it } from 'vitest';
import { DATASET_CITATIONS } from '../../shared/briefs';
import { validateBriefs } from './briefs';

const citation = { title: 'T', authors: 'A', year: 2024, venue: 'V', url: 'https://example.org' };
const ids = new Set(['COD', 'LUX']);

describe('validateBriefs', () => {
  it('resolves both built-in dataset keys and defined sources', () => {
    const briefs = validateBriefs(
      {
        sources: { 'x:a': citation },
        briefs: [{ id: 'COD', text: ' Cobalt. ', sources: ['data:usgs', 'x:a'] }],
      },
      ids,
    );
    expect(briefs).toEqual([
      { id: 'COD', text: 'Cobalt.', sources: [DATASET_CITATIONS['data:usgs'], citation] },
    ]);
  });

  it('rejects unknown countries, duplicates, missing or unknown sources and long text', () => {
    expect(() =>
      validateBriefs(
        {
          sources: { 'data:imf': citation, bad: { ...citation, url: '' } },
          briefs: [
            { id: 'XXX', text: 'x', sources: ['data:imf'] },
            { id: 'LUX', text: 'x', sources: [] },
            { id: 'LUX', text: 'x', sources: ['nope'] },
            { id: 'COD', text: 'word '.repeat(200), sources: ['data:usgs'] },
          ],
        },
        ids,
      ),
    ).toThrow(
      /shadows a built-in[\s\S]*bad: missing url[\s\S]*XXX: unknown country[\s\S]*LUX: no source[\s\S]*LUX: duplicate[\s\S]*unknown source nope[\s\S]*COD: 200 words/,
    );
  });
});
