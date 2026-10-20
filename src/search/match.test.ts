import { describe, expect, it } from 'vitest';
import type { Country } from '../../shared/types';
import { buildSearchIndex, searchCountries } from './match';

const country = (id: string, name: string, aliases: string[] = []): Country => ({
  id,
  iso3: id,
  iso2: null,
  name,
  formalName: null,
  status: 'un_member',
  sovereign: null,
  region: null,
  subregion: null,
  label: [0, 0],
  bbox: [0, 0, 1, 1],
  tiny: false,
  aliases,
});

const index = buildSearchIndex([
  country('NER', 'Niger'),
  country('NGA', 'Nigeria'),
  country('CIV', "Côte d'Ivoire", ['Ivory Coast']),
  country('DEU', 'Germany', ['Allemagne', 'Niemcy', 'Германия']),
  country('PNG', 'Papua New Guinea'),
]);
const names = (q: string) => searchCountries(index, q).map((c) => c.name);

describe('searchCountries', () => {
  it('puts the exact match before longer names', () => {
    expect(names('niger')).toEqual(['Niger', 'Nigeria']);
  });

  it('ignores accents and case', () => {
    expect(names('COTE')).toEqual(["Côte d'Ivoire"]);
  });

  it('matches aliases in other languages and ISO codes', () => {
    expect(names('niemcy')).toEqual(['Germany']);
    expect(names('германия')).toEqual(['Germany']);
    expect(names('deu')).toEqual(['Germany']);
    expect(names('ivory')).toEqual(["Côte d'Ivoire"]);
  });

  it('matches the start of any word', () => {
    expect(names('guinea')).toEqual(['Papua New Guinea']);
  });

  it('returns nothing for an empty query', () => {
    expect(names('  ')).toEqual([]);
  });
});
