import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_LABELS } from '../shared/status';
import type { Country } from '../shared/types';
import { loadBaseData, type BaseData } from './data/load';
import { toMapFeatures } from './map/geometry';
import { WorldMap, type FocusRequest } from './map/WorldMap';
import { CountryPanel } from './panel/CountryPanel';
import { CountrySearch } from './search/CountrySearch';
import { useMediaQuery } from './useMediaQuery';

const idFromHash = () => decodeURIComponent(window.location.hash.slice(1)) || null;

export function App() {
  const [data, setData] = useState<BaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [focus, setFocus] = useState<FocusRequest | null>(() => {
    const id = idFromHash();
    return id ? { id, nonce: 0 } : null;
  });
  const wide = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    loadBaseData().then(setData, (e: Error) => setError(e.message));
  }, []);

  // Keep the selection in the URL so a country view can be bookmarked.
  useEffect(() => {
    const target = selectedId ? `#${selectedId}` : ' ';
    if (window.location.hash !== (selectedId ? target : '')) {
      history.replaceState(null, '', target.trim() || window.location.pathname);
    }
  }, [selectedId]);

  const countries = data?.countries.data;
  const byId = useMemo(() => new Map((countries ?? []).map((c) => [c.id, c])), [countries]);
  const features = useMemo(() => data && toMapFeatures(data.topo, data.countries.data), [data]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const selectAndFocus = useCallback((id: string) => {
    setSelectedId(id);
    setFocus((f) => ({ id, nonce: (f?.nonce ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const boundariesMeta = data?.manifest.datasets.find(
    (d) => d.path === 'geo/countries.topo.json',
  )?.meta;
  const panelInset = useMemo(
    () =>
      selected
        ? wide
          ? { right: 400, bottom: 0 }
          : { right: 0, bottom: window.innerHeight * 0.5 }
        : { right: 0, bottom: 0 },
    [selected, wide],
  );

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
          panelInset={panelInset}
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
