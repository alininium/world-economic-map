import { normalizeName } from '../../shared/text';
import type { Country } from '../../shared/types';

export interface SearchIndexEntry {
  country: Country;
  /** Normalized primary name, then aliases and codes. */
  keys: string[];
}

export function buildSearchIndex(countries: readonly Country[]): SearchIndexEntry[] {
  return countries
    .filter((c) => c.status !== 'other')
    .map((country) => ({
      country,
      keys: [country.name, ...country.aliases, country.id, country.iso2 ?? '']
        .filter(Boolean)
        .map(normalizeName),
    }));
}

/**
 * Ranks countries for a query: exact name or code first, then names starting with the
 * query, then names containing a word that starts with it, then any substring match.
 */
export function searchCountries(
  index: readonly SearchIndexEntry[],
  query: string,
  limit = 8,
): Country[] {
  const q = normalizeName(query);
  if (!q) return [];
  const scored: { country: Country; score: number }[] = [];
  for (const { country, keys } of index) {
    let best = Infinity;
    keys.forEach((key, i) => {
      const penalty = i === 0 ? 0 : 0.5;
      let score = Infinity;
      if (key === q) score = 0;
      else if (key.startsWith(q)) score = 1;
      else if (key.split(' ').some((w) => w.startsWith(q))) score = 2;
      else if (key.includes(q)) score = 3;
      best = Math.min(best, score + penalty);
    });
    if (best < Infinity) scored.push({ country, score: best });
  }
  scored.sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name, 'en'));
  return scored.slice(0, limit).map((s) => s.country);
}
