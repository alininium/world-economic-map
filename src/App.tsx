import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INDICATOR_BY_KEY, INDICATORS, type IndicatorKey } from '../shared/indicators';
import { SOVEREIGN_STATUSES, STATUS_LABELS } from '../shared/status';
import type { Country } from '../shared/types';
import { MetricPicker } from './controls/MetricPicker';
import { loadAppData, metaFor, type AppData } from './data/load';
import { buildMacroIndex, SOURCE_LABELS } from './data/macro';
import { formatValue } from './format';
import { buildClasses, colorFor } from './map/choropleth';
import { toMapFeatures } from './map/geometry';
import { Legend } from './map/Legend';
import { paletteFor } from './map/palette';
import { WorldMap, type FocusRequest } from './map/WorldMap';
import { CountryPanel } from './panel/CountryPanel';
import { MacroSnapshot } from './panel/MacroSnapshot';
import { CountrySearch } from './search/CountrySearch';
import { useMediaQuery } from './useMediaQuery';

function idFromHash(): string | null {
  try {
    return decodeURIComponent(window.location.hash.slice(1)) || null;
  } catch {
    return null; // malformed escape in a hand-edited or truncated link
  }
}

function metricFromUrl(): IndicatorKey | null {
  const m = new URLSearchParams(window.location.search).get('metric');
  return m && Object.hasOwn(INDICATOR_BY_KEY, m) && INDICATOR_BY_KEY[m as IndicatorKey].choropleth
    ? (m as IndicatorKey)
    : null;
}

/** Shown in the tooltip when no metric is selected. */
const HEADLINE: IndicatorKey = 'gdp';

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [metric, setMetric] = useState<IndicatorKey | null>(metricFromUrl);
  const [focus, setFocus] = useState<FocusRequest | null>(() => {
    const id = idFromHash();
    return id ? { id, nonce: 0 } : null;
  });
  const darkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadAppData().then(setData, (e: Error) => setError(e.message));
  }, []);

  // Keep the selection (hash) and metric (?metric=) in the URL so a view can be bookmarked.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (metric) url.searchParams.set('metric', metric);
    else url.searchParams.delete('metric');
    url.hash = selectedId ? `#${selectedId}` : '';
    if (url.href !== window.location.href) history.replaceState(null, '', url);
  }, [selectedId, metric]);

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
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
      if (e.key === 'Escape' && !typing) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const countries = data?.countries.data;
  const byId = useMemo(() => new Map((countries ?? []).map((c) => [c.id, c])), [countries]);
  const features = useMemo(() => data && toMapFeatures(data.topo, data.countries.data), [data]);

  const macro = useMemo(
    () =>
      buildMacroIndex({
        worldbank: data?.macro.worldbank?.data,
        imf: data?.macro.imf?.data,
      }),
    [data],
  );
  /** Indicators with at least one source downloaded. */
  const loaded = useMemo(
    () =>
      new Set(
        INDICATORS.filter((d) => d.series.some((s) => data?.macro[s.source])).map((d) => d.key),
      ),
    [data],
  );
  const available = useMemo(
    () => new Set(INDICATORS.filter((d) => Object.keys(macro[d.key]).length).map((d) => d.key)),
    [macro],
  );
  const activeMetric = metric && available.has(metric) ? metric : null;

  const palette = paletteFor(darkMode);
  const choropleth = useMemo(() => {
    if (!activeMetric) return null;
    const def = INDICATOR_BY_KEY[activeMetric];
    const figures = macro[activeMetric];
    // Class breaks come from sovereign states only; dependencies are coloured but do not shift them.
    const ranked = Object.entries(figures)
      .filter(([id]) => {
        const c = byId.get(id);
        return c && SOVEREIGN_STATUSES.has(c.status);
      })
      .map(([, f]) => f.value);
    const all = Object.values(figures).map((f) => f.value);
    const bins = buildClasses(ranked, def.scaleKind, palette, all);
    const colors: Record<string, string> = {};
    for (const [id, f] of Object.entries(figures)) {
      const color = colorFor(f.value, bins);
      if (color) colors[id] = color;
    }
    return { def, bins, colors, figures: Object.values(figures) };
  }, [activeMetric, macro, byId, palette]);

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

  const renderTooltip = (c: Country) => {
    const key = activeMetric ?? HEADLINE;
    const def = INDICATOR_BY_KEY[key];
    const fig = macro[key][c.id];
    return (
      <>
        <strong>{c.name}</strong>
        {loaded.has(key) && (
          <span>
            {def.label}:{' '}
            {fig
              ? `${formatValue(fig.value, def.unit)} (${fig.year}, ${SOURCE_LABELS[fig.source]})`
              : 'no data'}
          </span>
        )}
        {c.status !== 'un_member' && <span>{STATUS_LABELS[c.status]}</span>}
      </>
    );
  };

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const boundariesMeta = data && metaFor(data.manifest, 'geo/countries.topo.json');

  return (
    <div className={`app ${selected ? 'has-panel' : ''}`}>
      <header className="topbar">
        <h1>World Economic Map</h1>
        {countries && <CountrySearch countries={countries} onPick={selectAndFocus} />}
        {data && <MetricPicker value={activeMetric} available={available} onChange={setMetric} />}
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
          fillColors={choropleth?.colors ?? null}
          getObscured={getObscured}
          onSelect={select}
          renderTooltip={renderTooltip}
        />
      )}

      {choropleth && (
        <Legend
          def={choropleth.def}
          bins={choropleth.bins}
          noDataColor={palette.noData}
          figures={choropleth.figures}
        />
      )}

      {selected && boundariesMeta && data && (
        <CountryPanel
          key={selected.id}
          ref={panelRef}
          country={selected}
          sovereign={selected.sovereign ? byId.get(selected.sovereign) : undefined}
          boundariesMeta={boundariesMeta}
          onClose={() => setSelectedId(null)}
          onSelect={selectAndFocus}
        >
          <MacroSnapshot
            country={selected}
            macro={macro}
            loaded={loaded}
            currencies={data.currencies?.data[selected.id]}
            currencyMeta={data.currencies?.meta}
          />
        </CountryPanel>
      )}
    </div>
  );
}
