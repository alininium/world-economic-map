import { describe, expect, it } from 'vitest';
import { MAX_COMPARE, parseCompare, toggleCompare } from './compare';

describe('parseCompare', () => {
  it('normalises, de-duplicates and caps the list', () => {
    expect(parseCompare('fra, DEU,fra,,ita,esp,pol')).toEqual(['FRA', 'DEU', 'ITA', 'ESP']);
  });

  it('drops unknown ids when the valid set is given', () => {
    expect(parseCompare('FRA,XXX', new Set(['FRA']))).toEqual(['FRA']);
  });
});

describe('toggleCompare', () => {
  it('adds and removes', () => {
    expect(toggleCompare(['FRA'], 'DEU')).toEqual(['FRA', 'DEU']);
    expect(toggleCompare(['FRA', 'DEU'], 'FRA')).toEqual(['DEU']);
  });

  it('drops the oldest beyond the limit', () => {
    const full = ['A', 'B', 'C', 'D'].slice(0, MAX_COMPARE);
    expect(toggleCompare(full, 'E')).toEqual([...full.slice(1), 'E']);
  });
});
