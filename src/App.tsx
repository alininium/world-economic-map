import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMMODITY_BY_ID, MEASURE_LABELS, MEASURES, type Measure } from '../shared/commodities';
import { INDICATOR_BY_KEY, INDICATORS, type IndicatorKey } from '../shared/indicators';
import { SOVEREIGN_STATUSES, STATUS_LABELS } from '../shared/status';
import type { TradeProfile } from '../shared/trade';
import type { Country } from '../shared/types';
import { CommodityCard } from './controls/CommodityCard';
import { MetricPicker, type MapMode } from './controls/MetricPicker';
import { loadAppData, loadTradeProfile, metaFor, type AppData } from './data/load';
import { buildMacroIndex, SOURCE_LABELS } from './data/macro';
import { buildResourceIndex, countryResources } from './data/resources';
import { formatQuantity, formatValue } from './format';
import { buildClasses, colorFor } from './map/choropleth';
import { flowLines } from './map/flows';
import { toMapFeatures } from './map/geometry';
import { Legend } from './map/Legend';
import { paletteFor } from './map/palette';
import { WorldMap, type FocusRequest } from './map/WorldMap';
import { CountryPanel } from './panel/CountryPanel';
import { MacroSnapshot } from './panel/MacroSnapshot';
import { ResourcesSection } from './panel/ResourcesSection';
import { CountrySearch } from './search/CountrySearch';
import { useMediaQuery } from './useMediaQuery';

// ECharts is only needed once a country is opened; keep it out of the initial bundle.
const TradeSection = lazy(() => import('./panel/TradeSection'));

function idFromHash(): string | null {
  try {
    return decodeURIComponent(window.location.hash.slice(1)) || null;
  } catch {
    return null; // malformed escape in a hand-edited or truncated link
  }
}

/** Reads ?metric= or ?commodity=&measure= (own keys only, choropleth metrics only). */
function modeFromUrl(): { mode: MapMode; measure: Measure } {
  const q = new URLSearchParams(window.location.search);
  const m = q.get('metric');
  const c = q.get('commodity');
  const ms = q.get('measure');
  const measure =
    ms && (MEASURES as readonly string[]).includes(ms) ? (ms as Measure) : 'production';
  if (m && Object.hasOwn(INDICATOR_BY_KEY, m) && INDICATOR_BY_KEY[m as IndicatorKey].choropleth) {
    return { mode: { kind: 'indicator', key: m as IndicatorKey }, measure };
  }
  if (c && Object.hasOwn(COMMODITY_BY_ID, c))
    return { mode: { kind: 'commodity', id: c }, measure };
  return { mode: { kind: 'political' }, measure };
}

/** Shown in the tooltip when no metric is selected. */
const HEADLINE: IndicatorKey = 'gdp';

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [mode, setMode] = useState<MapMode>(() => modeFromUrl().mode);
  const [measure, setMeasure] = useState<Measure>(() => modeFromUrl().measure);
  const [focus, setFocus] = useState<FocusRequest | null>(() => {
    const id = idFromHash();
    return id ? { id, nonce: 0 } : null;
  });
  const darkMode = useMediaQuery('(prefers-color-scheme: dark)');
  /** The selected country's trade profile; `profile` is null when it has none. */
  const [trade, setTrade] = useState<{
    id: string;
    profile: TradeProfile | null;
    error?: string;
  } | null>(null);
  /** Bumped by "Retry" to reload the trade profile. */
  const [tradeAttempt, setTradeAttempt] = useState(0);
  const [showFlows, setShowFlows] = useState(true);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadAppData().then(setData, (e: Error) => setError(e.message));
  }, []);

  // Keep the selection (hash) and map mode (query) in the URL so a view can be bookmarked.
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const k of ['metric', 'commodity', 'measure']) url.searchParams.delete(k);
    if (mode.kind === 'indicator') url.searchParams.set('metric', mode.key);
    if (mode.kind === 'commodity') {
      url.searchParams.set('commodity', mode.id);
      url.searchParams.set('measure', measure);
    }
    url.hash = selectedId ? `#${selectedId}` : '';
    if (url.href !== window.location.href) history.replaceState(null, '', url);
  }, [selectedId, mode, measure]);

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
        comtrade: data?.macro.comtrade?.data,
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
  const activeMetric = mode.kind === 'indicator' && available.has(mode.key) ? mode.key : null;
  const resources = useMemo(() => buildResourceIndex(data?.resources ?? []), [data]);
  const commoditiesLoaded = useMemo(() => new Set(Object.keys(resources)), [resources]);
  const activeCommodity =
    mode.kind === 'commodity' && commoditiesLoaded.has(mode.id) ? mode.id : null;
  const isRanked = useCallback(
    (id: string) => {
      const c = byId.get(id);
      return !!c && SOVEREIGN_STATUSES.has(c.status);
    },
    [byId],
  );

  const palette = paletteFor(darkMode);
  const commodityMap = useMemo(() => {
    const series = activeCommodity ? resources[activeCommodity]?.[measure] : undefined;
    if (!series) return null;
    const entries = Object.entries(series.table.values).filter(([, o]) => o.value > 0);
    const ranked = entries.filter(([id]) => isRanked(id)).map(([, o]) => o.value);
    const bins = buildClasses(
      ranked,
      'sequential',
      palette,
      entries.map(([, o]) => o.value),
    );
    const colors: Record<string, string> = {};
    for (const [id, o] of entries) {
      const color = colorFor(o.value, bins);
      if (color) colors[id] = color;
    }
    return { bins, colors, series };
  }, [activeCommodity, measure, resources, isRanked, palette]);

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

  useEffect(() => {
    if (!data || !selectedId) return;
    let cancelled = false;
    loadTradeProfile(data.manifest, selectedId).then(
      (profile) => {
        if (!cancelled) setTrade({ id: selectedId, profile });
      },
      (err: Error) => {
        if (!cancelled) setTrade({ id: selectedId, profile: null, error: err.message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [data, selectedId, tradeAttempt]);

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
    if (activeCommodity && commodityMap) {
      const o = commodityMap.series.table.values[c.id];
      return (
        <>
          <strong>{c.name}</strong>
          <span>
            {COMMODITY_BY_ID[activeCommodity]!.label} {MEASURE_LABELS[measure].toLowerCase()}:{' '}
            {o
              ? `${formatQuantity(o.value, commodityMap.series.table.unit)} (${o.year})`
              : 'not listed'}
          </span>
        </>
      );
    }
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
  const tradeState = trade && trade.id === selectedId ? trade : undefined;
  const tradeProfile = tradeState?.profile;
  const flows = useMemo(
    () => (selected && tradeProfile && showFlows ? flowLines(selected, tradeProfile, byId) : null),
    [selected, tradeProfile, showFlows, byId],
  );

  return (
    <div className={`app ${selected ? 'has-panel' : ''}`}>
      <header className="topbar">
        <h1>World Economic Map</h1>
        {countries && <CountrySearch countries={countries} onPick={selectAndFocus} />}
        {data && (
          <MetricPicker
            value={
              activeMetric
                ? { kind: 'indicator', key: activeMetric }
                : activeCommodity
                  ? { kind: 'commodity', id: activeCommodity }
                  : { kind: 'political' }
            }
            available={available}
            commodities={commoditiesLoaded}
            onChange={(m) => {
              setMode(m);
              // Open a commodity on a measure it has, preferring production.
              if (m.kind === 'commodity') {
                const has = resources[m.id] ?? {};
                setMeasure(MEASURES.find((x) => has[x]) ?? 'production');
              }
            }}
          />
        )}
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
          fillColors={commodityMap?.colors ?? choropleth?.colors ?? null}
          flows={flows}
          getObscured={getObscured}
          onSelect={select}
          renderTooltip={renderTooltip}
        />
      )}

      {activeCommodity && (
        <CommodityCard
          commodity={activeCommodity}
          measure={measure}
          index={resources}
          countries={byId}
          isRanked={isRanked}
          bins={commodityMap?.bins ?? []}
          noDataColor={palette.noData}
          onMeasure={setMeasure}
          onSelectCountry={selectAndFocus}
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
          <ResourcesSection
            rows={countryResources(resources, selected.id, isRanked)}
            anyLoaded={commoditiesLoaded.size > 0}
            onOpenCommodity={(id) => {
              setMode({ kind: 'commodity', id });
              const has = resources[id] ?? {};
              setMeasure(MEASURES.find((x) => has[x]) ?? 'production');
            }}
          />
          {tradeState === undefined ? (
            <p className="muted small">Loading trade…</p>
          ) : (
            <Suspense fallback={<p className="muted small">Loading trade…</p>}>
              <TradeSection
                profile={tradeState.profile}
                error={tradeState.error}
                onRetry={() => setTradeAttempt((n) => n + 1)}
                meta={metaFor(data.manifest, 'trade/by-country/')}
                darkMode={darkMode}
                colors={{ exports: palette.flowExports, imports: palette.flowImports }}
                showFlows={showFlows}
                onShowFlows={setShowFlows}
              />
            </Suspense>
          )}
        </CountryPanel>
      )}
    </div>
  );
}
