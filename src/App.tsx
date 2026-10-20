import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_LABELS } from '../shared/status';
import type { Country } from '../shared/types';
import { loadBaseData, type BaseData } from './data/load';
import { toMapFeatures } from './map/geometry';
import { WorldMap, type FocusRequest } from './map/WorldMap';
import { CountryPanel } from './panel/CountryPanel';
import { CountrySearch } from './search/CountrySearch';
import { useMediaQuery } from './useMediaQuery';

function idFromHash(): string | null {
  try {
    return decodeURIComponent(window.location.hash.slice(1)) || null;
  } catch {
    return null; // malformed escape in a hand-edited or truncated link
  }
}

export function App() {
  const [data, setData] = useState<BaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [focus, setFocus] = useState<FocusRequest | null>(() => {
    const id = idFromHash();
    return id ? { id, nonce: 0 } : null;
  });
  const darkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadBaseData().then(setData, (e: Error) => setError(e.message));
  }, []);

  // Keep the selection in the URL so a country view can be bookmarked.
  useEffect(() => {
    if (idFromHash() === selectedId) return;
    history.replaceState(null, '', selectedId ? `#${selectedId}` : window.location.pathname);
  }, [selectedId]);

  const focusOn = useCallback((id: string) => {
    setFocus((f) => ({ id, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);

  // Follow links and hand edits to the hash while the app is open.
  useEffect(() => {
    const onHashChange = () => {
      const id = idFromHash();
      setSelectedId(id);
      if (id) focusOn(id);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [focusOn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const countries = data?.countries.data;
  const byId = useMemo(() => new Map((countries ?? []).map((c) => [c.id, c])), [countries]);
  const features = useMemo(() => data && toMapFeatures(data.topo, data.countries.data), [data]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const selectAndFocus = useCallback(
    (id: string) => {
      setSelectedId(id);
      focusOn(id);
    },
    [focusOn],
  );

  /** How much of the map the panel covers: a right column on wide screens, a bottom sheet on phones. */
  const getObscured = useCallback(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return { right: 0, bottom: 0 };
    return rect.top > 0
      ? { right: 0, bottom: window.innerHeight - rect.top }
      : { right: window.innerWidth - rect.left, bottom: 0 };
  }, []);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const boundariesMeta = data?.manifest.datasets.find(
    (d) => d.path === 'geo/countries.topo.json',
  )?.meta;

  return (
    <div className={`app ${selected ? 'has-panel' : ''}`}>
      <header className="topbar">
        <h1>World Economic Map</h1>
        {countries && <CountrySearch countries={countries} onPick={selectAndFocus} />}
      </header>

      {error && (
        <p className="status-message" role="alert">
          Could not load map data: {error}. Run <code>npm run data:refresh</code> and reload.
        </p>
      )}
      {!data && !error && <p className="status-message">Loading map…</p>}

      {features && (
        <WorldMap
          features={features}
          countries={byId}
          selectedId={selectedId}
          focus={focus}
          darkMode={darkMode}
          getObscured={getObscured}
          onSelect={select}
          renderTooltip={(c: Country) => (
            <>
              <strong>{c.name}</strong>
              <span>{STATUS_LABELS[c.status]}</span>
            </>
          )}
        />
      )}

      {selected && boundariesMeta && (
        <CountryPanel
          key={selected.id}
          ref={panelRef}
          country={selected}
          sovereign={selected.sovereign ? byId.get(selected.sovereign) : undefined}
          boundariesMeta={boundariesMeta}
          onClose={() => setSelectedId(null)}
          onSelect={selectAndFocus}
        />
      )}
    </div>
  );
}
