import { describe, expect, it } from 'vitest';
import { checkMeta, checkValues } from './check';

describe('checkValues', () => {
  const ids = new Set(['FRA', 'DEU']);

  it('accepts known ids with finite values, at any depth', () => {
    expect(checkValues({ 'NY.GDP': { FRA: { value: 1, year: 2024 } } }, ids, 'x')).toEqual([]);
    expect(
      checkValues({ oil: { production: { values: { DEU: { value: 2, year: 2024 } } } } }, ids, 'x'),
    ).toEqual([]);
  });

  it('reports unknown ids and non-finite values', () => {
    const problems = checkValues(
      { s: { XYZ: { value: 1, year: 2024 }, FRA: { value: null, year: 2024 } } },
      ids,
      'x',
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/unknown country id XYZ/);
    expect(problems[1]).toMatch(/non-finite value for FRA/);
  });
});

describe('checkMeta', () => {
  it('requires provenance fields', () => {
    expect(
      checkMeta({ source: 's', sourceUrl: 'u', license: 'l', retrievedAt: '2026-01-01' }, 'x'),
    ).toEqual([]);
    expect(checkMeta({ source: 's' }, 'x')).toHaveLength(3);
    expect(checkMeta(undefined, 'x')).toEqual(['x: no meta']);
  });
});
