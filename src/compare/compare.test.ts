import { describe, expect, it } from 'vitest';
import { MAX_COMPARE, parseCompare, toggleCompare, validCompare } from './compare';

describe('parseCompare', () => {
  it('normalises and de-duplicates the list', () => {
    expect(parseCompare('fra, DEU,fra,,ita')).toEqual(['FRA', 'DEU', 'ITA']);
  });
});

describe('validCompare', () => {
  it('drops unknown ids before capping, so they cannot crowd out real ones', () => {
    const ids = parseCompare('XXX,YYY,ZZZ,WWW,FRA,DEU,ITA,ESP,POL');
    expect(validCompare(ids, new Set(['FRA', 'DEU', 'ITA', 'ESP', 'POL']))).toEqual([
      'FRA',
      'DEU',
      'ITA',
      'ESP',
    ]);
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
