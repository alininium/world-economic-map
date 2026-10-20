import {
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Country } from '../../shared/types';
import type { MapFeatures } from './geometry';
import { paletteFor } from './palette';
import {
  HATCH_IMAGE,
  INTERACTIVE_LAYERS,
  EMPTY_FLOWS,
  SOURCE_FLOWS,
  SOURCE_MARKERS,
  SOURCE_SHAPES,
  applyHatch,
  applyPaint,
  buildStyle,
  hatchImage,
  type FillColors,
} from './style';

// MapLibre 6 ships its web worker as a separate file; let Vite emit it and tell MapLibre where it is.
setWorkerUrl(workerUrl);

export interface FocusRequest {
  id: string;
  /** Changes on every request so focusing the same country twice still moves the map. */
  nonce: number;
}

interface Props {
  features: MapFeatures;
  countries: ReadonlyMap<string, Country>;
  selectedId: string | null;
  focus: FocusRequest | null;
  darkMode: boolean;
  /** Colours for the active choropleth metric, or null for the plain political map. */
  fillColors: FillColors;
  /** Trade-flow lines for the selected country, or null for none. */
  flows: GeoJSON.FeatureCollection | null;
  /** Measures the map area covered by other UI (the detail panel) at the moment the camera moves. */
  getObscured: () => { right: number; bottom: number };
  onSelect: (id: string | null) => void;
  renderTooltip: (country: Country) => ReactNode;
}

interface Hover {
  id: string;
  x: number;
  y: number;
  /** Show the tooltip left of the cursor so it stays inside the map. */
  flip: boolean;
}

const isInteractive = (c: Country | undefined): c is Country => !!c && c.status !== 'other';

export function WorldMap({
  features,
  countries,
  selectedId,
  focus,
  darkMode,
  fillColors,
  flows,
  getObscured,
  onSelect,
  renderTooltip,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  /** What the map is currently painted with. */
  const applied = useRef<{ darkMode: boolean; fillColors: FillColors }>({
    darkMode,
    fillColors,
  });
  const [hover, setHover] = useState<Hover | null>(null);
  /** Country whose flows should be brought into view when they arrive (set by focus requests). */
  const pendingFlowFit = useRef<string | null>(null);

  /** The one camera move: fit bounds, keep clear of the panel, respect reduced motion. */
  const fitTo = (map: MapLibreMap, bounds: LngLatBounds, maxZoom: number) => {
    const obscured = latest.current.getObscured();
    map.fitBounds(bounds, {
      padding: { top: 72, left: 32, right: 32 + obscured.right, bottom: 32 + obscured.bottom },
      maxZoom,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900,
    });
  };
  // Feature state can only be set once the sources exist, i.e. after the first 'load'.
  const [loaded, setLoaded] = useState(false);
  // Handlers are attached once; keep the latest props in refs.
  const latest = useRef({ countries, onSelect, getObscured, darkMode, fillColors });
  useEffect(() => {
    latest.current = { countries, onSelect, getObscured, darkMode, fillColors };
  });

  useEffect(() => {
    const palette = paletteFor(latest.current.darkMode);
    applied.current = { darkMode: latest.current.darkMode, fillColors: latest.current.fillColors };
    const map = new MapLibreMap({
      container: container.current!,
      style: buildStyle(palette, features, latest.current.fillColors),
      center: [10, 25],
      zoom: 1.2,
      minZoom: 0.5,
      maxZoom: 8,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true, customAttribution: 'Boundaries: Natural Earth' },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-left');
    map.setMissingStyleImageResolver((id) => {
      if (id === HATCH_IMAGE) map.addImage(HATCH_IMAGE, hatchImage(palette.hatch));
    });

    let hoveredId: string | null = null;
    const setHoverState = (id: string | null) => {
      if (hoveredId === id) return;
      for (const [prev, value] of [
        [hoveredId, false],
        [id, true],
      ] as const) {
        if (!prev) continue;
        map.setFeatureState({ source: SOURCE_SHAPES, id: prev }, { hover: value });
        map.setFeatureState({ source: SOURCE_MARKERS, id: prev }, { hover: value });
      }
      hoveredId = id;
    };

    const pick = (point: { x: number; y: number }): Country | undefined => {
      const hit = map.queryRenderedFeatures([point.x, point.y], { layers: INTERACTIVE_LAYERS });
      // Markers are drawn on top; prefer them so tiny states win over the polygon underneath.
      hit.sort(
        (a, b) => (a.layer.type === 'circle' ? -1 : 0) - (b.layer.type === 'circle' ? -1 : 0),
      );
      const country = latest.current.countries.get(String(hit[0]?.properties.id));
      return isInteractive(country) ? country : undefined;
    };

    map.on('mousemove', (e) => {
      const c = pick(e.point);
      setHoverState(c?.id ?? null);
      map.getCanvas().style.cursor = c ? 'pointer' : '';
      const flip = e.point.x > map.getCanvas().clientWidth / 2;
      setHover(c ? { id: c.id, x: e.point.x, y: e.point.y, flip } : null);
    });
    const clearHover = () => {
      setHoverState(null);
      setHover(null);
    };
    map.on('mouseout', clearHover);
    // The feature under a still cursor changes when the camera moves.
    map.on('movestart', clearHover);
    map.on('click', (e) => {
      latest.current.onSelect(pick(e.point)?.id ?? null);
    });

    map.once('load', () => setLoaded(true));

    mapRef.current = map;
    return () => {
      mapRef.current = null;
      setLoaded(false);
      map.remove();
    };
  }, [features]);

  // Repaint for a new metric or OS colour scheme without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current;
    const prev = applied.current;
    if (!map || !loaded) return;
    if (prev.darkMode === darkMode && prev.fillColors === fillColors) return;
    const palette = paletteFor(darkMode);
    applyPaint(map, palette, fillColors);
    if (prev.darkMode !== darkMode) applyHatch(map, palette);
    applied.current = { darkMode, fillColors };
  }, [darkMode, fillColors, loaded]);

  // Draw trade flows. After a focus request (search, link) the view widens once to show
  // them; plain clicks and the flows toggle leave the camera alone.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    map.getSource<GeoJSONSource>(SOURCE_FLOWS)?.setData(flows ?? EMPTY_FLOWS);
    const origin = flows?.features[0]?.properties?.origin as string | undefined;
    if (!origin || origin !== pendingFlowFit.current) return;
    pendingFlowFit.current = null;
    const coords = flows!.features.flatMap((f) =>
      f.geometry.type === 'LineString' ? (f.geometry.coordinates as [number, number][]) : [],
    );
    const bounds = coords.reduce((b, c) => b.extend(c), new LngLatBounds(coords[0]!, coords[0]!));
    fitTo(map, bounds, 4);
  }, [flows, loaded]);

  // Mirror the selection into feature state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !selectedId) return;
    const set = (selected: boolean) => {
      map.setFeatureState({ source: SOURCE_SHAPES, id: selectedId }, { selected });
      map.setFeatureState({ source: SOURCE_MARKERS, id: selectedId }, { selected });
    };
    set(true);
    return () => {
      if (mapRef.current === map) set(false);
    };
  }, [selectedId, loaded]);

  // Move the camera when asked to (search, deep link), keeping clear of the panel.
  useEffect(() => {
    const map = mapRef.current;
    const country = focus && countries.get(focus.id);
    if (!map || !country) return;
    const [w, s, e, n] = country.bbox;
    fitTo(map, new LngLatBounds([w, s], [e, n]), country.tiny ? 6 : 5);
    pendingFlowFit.current = country.id;
  }, [focus, countries]);

  const hovered = hover ? countries.get(hover.id) : undefined;
  return (
    <div className="map-wrap">
      <div ref={container} className="map" aria-label="World map" role="region" />
      {hover && hovered && (
        <div
          className="map-tooltip"
          style={{
            transform: `translate(${hover.x}px, ${hover.y}px) translate(${
              hover.flip ? 'calc(-100% - 14px)' : '14px'
            }, 14px)`,
          }}
          role="tooltip"
        >
          {renderTooltip(hovered)}
        </div>
      )}
    </div>
  );
}
