import { describe, expect, it } from 'vitest';
import { buildMacroIndex } from './macro';

describe('buildMacroIndex', () => {
  // Made-up values; only the precedence logic is under test.
  const index = buildMacroIndex({
    worldbank: { 'NY.GDP.MKTP.CD': { AAA: { value: 100, year: 2024 } } },
    imf: {
      NGDPD: { AAA: { value: 999, year: 2025 }, TWN: { value: 800, year: 2025 } },
      GGXWDG_NGDP: { AAA: { value: 60, year: 2025 } },
    },
  });

  it('prefers the primary source and records where each figure came from', () => {
    expect(index.gdp.AAA).toEqual({ value: 100, year: 2024, source: 'worldbank', code: 'NY.GDP.MKTP.CD' });
  });

  it('falls back to the IMF only for countries the primary source lacks', () => {
    expect(index.gdp.TWN).toMatchObject({ value: 800, source: 'imf' });
  });

  it('leaves indicators empty when their source is not loaded', () => {
    expect(index.tradeBalance).toEqual({});
    expect(index.govDebt.AAA?.source).toBe('imf');
  });
});
