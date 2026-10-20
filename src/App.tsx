import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAIN_BY_ID } from '../shared/chains';
import { COMMODITY_BY_ID, MEASURE_LABELS, MEASURES, type Measure } from '../shared/commodities';
import { INDICATOR_BY_KEY, INDICATORS, type IndicatorKey } from '../shared/indicators';
import { SOVEREIGN_STATUSES, STATUS_LABELS } from '../shared/status';
import type { TradeProfile } from '../shared/trade';
import type { Country } from '../shared/types';
import { ChainCard } from './controls/ChainCard';
import { CommodityCard } from './controls/CommodityCard';
import { MetricPicker, type MapMode } from './controls/MetricPicker';
import { countryChainTrade, netTrade, notesAbout, notesFor, type NetTrade } from './data/chains';
import { loadAppData, loadTradeProfile, metaFor, type AppData } from './data/load';
import { buildMacroIndex, SOURCE_LABELS } from './data/macro';
import { buildResourceIndex, countryResources } from './data/resources';
import { formatQuantity, formatValue } from './format';
import { classify } from './map/choropleth';
import { flowLines } from './map/flows';
import { toMapFeatures } from './map/geometry';
import { Legend } from './map/Legend';
import { paletteFor } from './map/palette';
import type { FocusRequest } from './map/WorldMap';
import { CompareTray } from './compare/CompareTray';
import { CompareView } from './compare/CompareView';
import { compareFromUrl, toggleCompare, validCompare as pickValid } from './compare/compare';
import { BriefSection } from './panel/BriefSection';
import { ChainSection } from './panel/ChainSection';
import { CountryPanel } from './panel/CountryPanel';
import { MacroSnapshot } from './panel/MacroSnapshot';
import { ResourcesSection } from './panel/ResourcesSection';
import { CountrySearch } from './search/CountrySearch';
import { useMediaQuery } from './useMediaQuery';

// ECharts is only needed once a country is opened; keep it out of the initial bundle.
const TradeSection = lazy(() => import('./panel/TradeSection'));
// The map (MapLibre) is the largest module; load it in parallel with the data so the page
// shell, search and panel code are not held up by it.
// The import starts as soon as this module runs, not when the map first renders (which only
// happens once the data has arrived).
const worldMapModule = import('./map/WorldMap');
const WorldMap = lazy(() => worldMapModule.then((m) => ({ default: m.WorldMap })));
const FdiSection = lazy(() => import('./panel/FdiSection'));

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
  const ch = q.get('chain');
  if (ch && Object.hasOwn(CHAIN_BY_ID, ch)) return { mode: { kind: 'chain', id: ch }, measure };
  return { mode: { kind: 'political' }, measure };
}

function stageFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('stage');
}

/** Shown in the tooltip when no metric is selected. */
const HEADLINE: IndicatorKey = 'gdp';

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);
  const [mode, setMode] = useState<MapMode>(() => modeFromUrl().mode);
  const [measure, setMeasure] = useState<Measure>(() => modeFromUrl().measure);
  const [chainStage, setChainStage] = useState<string | null>(stageFromUrl);
  const [compareIds, setCompareIds] = useState<string[]>(() => compareFromUrl());
  const [comparing, setComparing] = useState(false);
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

  /** Closes the panel and returns focus to the map, where countries are picked. */
  const closePanel = useCallback(() => {
    setSelectedId(null);
    document.querySelector<HTMLElement>('.maplibregl-canvas')?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
      if (e.key === 'Escape' && !typing) closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanel]);

  const countries = data?.countries.data;
  const byId = useMemo(() => new Map((countries ?? []).map((c) => [c.id, c])), [countries]);
  // Ids from a link may be unknown; only those that exist are compared.
  const validCompare = useMemo(
    () => (byId.size ? pickValid(compareIds, new Set(byId.keys())) : []),
    [compareIds, byId],
  );
  const removeCompare = useCallback(
    (id: string) => {
      const next = validCompare.filter((x) => x !== id);
      setCompareIds(next);
      // An emptied comparison closes, so adding a country later does not reopen it.
      if (next.length === 0) setComparing(false);
    },
    [validCompare],
  );
  const closeCompare = useCallback(() => setComparing(false), []);

  // Keep the selection (hash) and map mode (query) in the URL so a view can be bookmarked.
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const k of ['metric', 'commodity', 'measure', 'chain', 'stage', 'compare']) {
      url.searchParams.delete(k);
    }
    const compareParam = byId.size ? validCompare : compareIds;
    if (compareParam.length) url.searchParams.set('compare', compareParam.join(','));
    if (mode.kind === 'indicator') url.searchParams.set('metric', mode.key);
    if (mode.kind === 'commodity') {
      url.searchParams.set('commodity', mode.id);
      url.searchParams.set('measure', measure);
    }
    if (mode.kind === 'chain') {
      url.searchParams.set('chain', mode.id);
      if (chainStage) url.searchParams.set('stage', chainStage);
    }
    url.hash = selectedId ? `#${selectedId}` : '';
    if (url.href !== window.location.href) history.replaceState(null, '', url);
  }, [selectedId, mode, measure, chainStage, compareIds, validCompare, byId]);
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
  /** The measure shown: the one asked for if the commodity has it, else its first available. */
  const activeMeasure: Measure = useMemo(() => {
    const has = activeCommodity ? (resources[activeCommodity] ?? {}) : {};
    return has[measure] ? measure : (MEASURES.find((m) => has[m]) ?? measure);
  }, [activeCommodity, measure, resources]);
  const commodityMap = useMemo(() => {
    const series = activeCommodity ? resources[activeCommodity]?.[activeMeasure] : undefined;
    if (!series) return null;
    const entries = Object.entries(series.table.values)
      .filter(([, o]) => o.value > 0)
      .map(([id, o]) => [id, o.value] as const);
    return { ...classify(entries, isRanked, 'sequential', palette), series };
  }, [activeCommodity, activeMeasure, resources, isRanked, palette]);

  const chainNotes = useMemo(() => data?.chainNotes?.data ?? [], [data]);
  const briefsById = useMemo(
    () => new Map((data?.briefs?.data ?? []).map((b) => [b.id, b])),
    [data],
  );
  const chainTrade = data?.chainTrade?.data ?? null;
  const chainsAvailable = !!(data?.chainNotes || data?.chainTrade);
  const activeChain = mode.kind === 'chain' && chainsAvailable ? mode.id : null;
  const activeStage = activeChain
    ? (
        CHAIN_BY_ID[activeChain]!.stages.find((s) => s.id === chainStage) ??
        CHAIN_BY_ID[activeChain]!.stages[0]!
      ).id
    : null;
  const chainMap = useMemo(() => {
    if (!activeChain || !activeStage) return null;
    const stageTrade = chainTrade?.[activeChain]?.[activeStage];
    if (stageTrade) {
      const all = netTrade(stageTrade);
      const byCountry = new Map<string, NetTrade>(all.map((r) => [r.id, r]));
      const entries = all.map((r) => [r.id, r.net] as const);
      return {
        ...classify(entries, isRanked, 'diverging', palette),
        byCountry,
        ranked: all.filter((r) => isRanked(r.id)),
      };
    }
    // Without trade data, show the countries the cited notes name for this stage, by role.
    const colors: Record<string, string> = {};
    for (const n of notesFor(chainNotes, activeChain, activeStage)) {
      for (const c of n.dependents ?? []) colors[c] ??= palette.flowImports;
      for (const c of n.countries) colors[c] = palette.flowExports;
    }
    return { bins: null, colors, byCountry: null, ranked: null };
  }, [activeChain, activeStage, chainTrade, chainNotes, isRanked, palette]);

  const choropleth = useMemo(() => {
    if (!activeMetric) return null;
    const def = INDICATOR_BY_KEY[activeMetric];
    const figures = macro[activeMetric];
    const entries = Object.entries(figures).map(([id, f]) => [id, f.value] as const);
    const { bins, colors } = classify(entries, isRanked, def.scaleKind, palette);
    return { def, bins, colors, figures: Object.values(figures) };
  }, [activeMetric, macro, isRanked, palette]);

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
  const openChain = useCallback((id: string, stage: string | null) => {
    setMode({ kind: 'chain', id });
    setChainStage(stage);
  }, []);
  /** Shows a commodity, starting from production; activeMeasure falls back to what it has. */
  const openCommodity = useCallback((id: string) => {
    setMode({ kind: 'commodity', id });
    setMeasure('production');
  }, []);
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
            {COMMODITY_BY_ID[activeCommodity]!.label} {MEASURE_LABELS[activeMeasure].toLowerCase()}:{' '}
            {o
              ? `${formatQuantity(o.value, commodityMap.series.table.unit)} (${o.year})`
              : 'not listed'}
          </span>
        </>
      );
    }
    if (activeChain && activeStage && chainMap) {
      const stage = CHAIN_BY_ID[activeChain]!.stages.find((s) => s.id === activeStage)!;
      const r = chainMap.byCountry?.get(c.id);
      const stageNotes = notesFor(chainNotes, activeChain, activeStage);
      const supplier = stageNotes.some((n) => n.countries.includes(c.id));
      const dependent = stageNotes.some((n) => n.dependents?.includes(c.id));
      return (
        <>
          <strong>{c.name}</strong>
          <span>{stage.label}</span>
          {r && (
            <span>
              {r.net >= 0 ? 'Net exporter' : 'Net importer'} {formatValue(Math.abs(r.net), 'usd')} (
              {r.year})
            </span>
          )}
          {supplier && <span>Named in a cited note as producer or supplier</span>}
          {dependent && <span>Named in a cited note as relying on others</span>}
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
  const chainRoles = useMemo(
    () => (chainTrade && selectedId ? countryChainTrade(chainTrade, selectedId) : []),
    [chainTrade, selectedId],
  );
  const tradeProfile = tradeState?.profile;
  const flows = useMemo(
    () => (selected && tradeProfile && showFlows ? flowLines(selected, tradeProfile, byId) : null),
    [selected, tradeProfile, showFlows, byId],
  );

  return (
    <div className={`app ${selected ? 'has-panel' : ''}`}>
      {/* Moves focus without touching the URL hash, which holds the selected country. */}
      <a
        className="skip-link"
        href="#country-search"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('country-search')?.focus();
        }}
      >
        Skip to country search
      </a>
      <p className="visually-hidden" aria-live="polite">
        {selected ? `${selected.name} selected` : ''}
      </p>
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
                  : activeChain
                    ? { kind: 'chain', id: activeChain }
                    : { kind: 'political' }
            }
            available={available}
            commodities={commoditiesLoaded}
            chainsAvailable={chainsAvailable}
            onChange={(m) =>
              m.kind === 'commodity'
                ? openCommodity(m.id)
                : m.kind === 'chain'
                  ? openChain(m.id, null)
                  : setMode(m)
            }
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
        <Suspense fallback={<p className="status-message">Loading map…</p>}>
          <WorldMap
            features={features}
            countries={byId}
            selectedId={selectedId}
            focus={focus}
            darkMode={darkMode}
            fillColors={commodityMap?.colors ?? chainMap?.colors ?? choropleth?.colors ?? null}
            flows={flows}
            getObscured={getObscured}
            onSelect={select}
            renderTooltip={renderTooltip}
          />
        </Suspense>
      )}

      <CompareTray
        ids={validCompare}
        countries={byId}
        onRemove={removeCompare}
        onOpen={() => setComparing(true)}
      />
      {comparing && validCompare.length > 0 && data && (
        <CompareView
          ids={validCompare}
          countries={byId}
          macro={macro}
          loaded={loaded}
          resources={resources}
          currencies={data.currencies?.data}
          onRemove={removeCompare}
          onClose={closeCompare}
        />
      )}

      {activeCommodity && (
        <CommodityCard
          commodity={activeCommodity}
          measure={activeMeasure}
          index={resources}
          countries={byId}
          isRanked={isRanked}
          bins={commodityMap?.bins ?? []}
          noDataColor={palette.noData}
          onMeasure={setMeasure}
          onSelectCountry={selectAndFocus}
        />
      )}

      {activeChain && activeStage && (
        <ChainCard
          chain={activeChain}
          stage={activeStage}
          notes={chainNotes}
          ranked={chainMap?.ranked ?? null}
          countries={byId}
          bins={chainMap?.bins ?? null}
          supplierColor={palette.flowExports}
          dependentColor={palette.flowImports}
          noDataColor={palette.noData}
          onStage={setChainStage}
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
          onClose={closePanel}
          inCompare={validCompare.includes(selected.id)}
          onToggleCompare={() => setCompareIds(toggleCompare(validCompare, selected.id))}
          onSelect={selectAndFocus}
          brief={
            <BriefSection
              brief={briefsById.get(selected.id)}
              loaded={!!data.briefs}
              meta={data.briefs?.meta}
            />
          }
        >
          <MacroSnapshot
            country={selected}
            macro={macro}
            loaded={loaded}
            currencies={data.currencies?.data[selected.id]}
            currencyMeta={data.currencies?.meta}
          />
          <Suspense fallback={<p className="muted small">Loading investment…</p>}>
            <FdiSection
              country={selected}
              macro={macro}
              loaded={loaded}
              manifest={data.manifest}
              darkMode={darkMode}
              inflowColor={palette.flowExports}
              outflowColor={palette.flowImports}
            />
          </Suspense>
          <ResourcesSection
            rows={countryResources(resources, selected.id, isRanked)}
            anyLoaded={commoditiesLoaded.size > 0}
            onOpenCommodity={openCommodity}
          />
          <ChainSection
            countryId={selected.id}
            notes={notesAbout(chainNotes, selected.id)}
            roles={chainRoles}
            notesLoaded={!!data.chainNotes}
            tradeLoaded={!!chainTrade}
            onOpenChain={openChain}
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
