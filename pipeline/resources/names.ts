import { normalizeName } from '../../shared/text';
import type { Country } from '../../shared/types';

/** Country spellings used by USGS and other sources that our names and aliases do not cover. */
const EXTRA_ALIASES: Readonly<Record<string, string>> = {
  'congo kinshasa': 'COD',
  'congo brazzaville': 'COG',
  burma: 'MMR',
  'korea north': 'PRK',
  'korea republic of': 'KOR',
  'korea south': 'KOR',
  'cote d ivoire': 'CIV',
  laos: 'LAO',
  'united states': 'USA',
  turkey: 'TUR',
  'czech republic': 'CZE',
  macedonia: 'MKD',
  swaziland: 'SWZ',
  russia: 'RUS',
  vietnam: 'VNM',
  iran: 'IRN',
  syria: 'SYR',
  bolivia: 'BOL',
  venezuela: 'VEN',
  tanzania: 'TZA',
  brunei: 'BRN',
  'cabo verde': 'CPV',
  'cape verde': 'CPV',
  'timor leste': 'TLS',
  'east timor': 'TLS',
  micronesia: 'FSM',
  moldova: 'MDA',
  taiwan: 'TWN',
  kosovo: 'XKX',
  gambia: 'GMB',
  bahamas: 'BHS',
  eswatini: 'SWZ',
  turkiye: 'TUR',
};

/** Rows that are aggregates rather than countries. */
export const isAggregate = (name: string): boolean =>
  /^(world|other|total|rest of|european union|eu\b)/i.test(name.trim());

export const isWorldTotal = (name: string): boolean => /^world/i.test(name.trim());

/** Resolves free-text country names to ids via names, aliases and EXTRA_ALIASES. */
export function nameResolver(countries: readonly Country[]): (name: string) => string | null {
  const index = new Map<string, string>();
  for (const c of countries) {
    for (const n of [c.name, c.formalName ?? '', ...c.aliases]) {
      if (n) index.set(normalizeName(n), c.id);
    }
  }
  for (const [n, id] of Object.entries(EXTRA_ALIASES)) index.set(n, id);
  return (name: string) => index.get(normalizeName(name)) ?? null;
}
