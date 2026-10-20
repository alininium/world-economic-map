import { describe, expect, it } from 'vitest';
import { buildMacroIndex, sourceLink } from './macro';

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

  it('replaces a primary figure only when the fallback is clearly newer', () => {
    const idx = buildMacroIndex({
      worldbank: {
        'SL.UEM.TOTL.ZS': { OLD: { value: 9, year: 2017 }, NEW: { value: 5, year: 2023 } },
      },
      imf: { LUR: { OLD: { value: 7, year: 2025 }, NEW: { value: 4, year: 2025 } } },
    });
    expect(idx.unemployment.OLD).toMatchObject({ value: 7, year: 2025, source: 'imf' });
    expect(idx.unemployment.NEW).toMatchObject({ value: 5, year: 2023, source: 'worldbank' });
  });

  it('leaves indicators empty when their source is not loaded', () => {
    expect(index.tradeBalance).toEqual({});
    expect(index.govDebt.AAA?.source).toBe('imf');
  });
});

describe('sourceLink', () => {
  it('scopes links to the country', () => {
    expect(sourceLink('worldbank', 'NY.GDP.MKTP.CD', { id: 'FRA', iso2: 'FR' })).toBe(
      'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=FR',
    );
    expect(sourceLink('imf', 'NGDPD', { id: 'TWN', iso2: 'TW' })).toBe(
      'https://www.imf.org/external/datamapper/NGDPD@WEO/TWN',
    );
  });
});
