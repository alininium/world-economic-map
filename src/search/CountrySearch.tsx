import { useId, useMemo, useRef, useState } from 'react';
import type { Country } from '../../shared/types';
import { buildSearchIndex, searchCountries } from './match';

interface Props {
  countries: readonly Country[];
  onPick: (id: string) => void;
}

/** Accessible combobox (WAI-ARIA 1.2 pattern) for finding a country by name, alias or ISO code. */
export function CountrySearch({ countries, onPick }: Props) {
  const index = useMemo(() => buildSearchIndex(countries), [countries]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchCountries(index, query), [index, query]);
  const showList = open && results.length > 0;

  const pick = (c: Country | undefined) => {
    if (!c) return;
    // Dismiss the on-screen keyboard on phones so the map and panel are visible.
    inputRef.current?.blur();
    onPick(c.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        id="country-search"
        type="search"
        placeholder="Search for a country…"
        aria-label="Search for a country"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            pick(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul id={listId} role="listbox" className="search-results">
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click, so it fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {c.name}
              {c.status !== 'un_member' && <span className="muted"> · {c.id}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
