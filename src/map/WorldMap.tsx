import { LngLatBounds, Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Country } from '../../shared/types';
import type { MapFeatures } from './geometry';
import { currentPalette } from './palette';
import {
  HATCH_IMAGE,
  INTERACTIVE_LAYERS,
  SOURCE_MARKERS,
  SOURCE_SHAPES,
  buildStyle,
  hatchImage,
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
  /** Pixels covered by the detail panel, so camera moves keep the country visible. */
  panelInset: { right: number; bottom: number };
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
  panelInset,
  onSelect,
  renderTooltip,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  // Handlers are attached once; keep the latest props in refs.
  const latest = useRef({ countries, onSelect });
  useEffect(() => {
    latest.current = { countries, onSelect };
  });

  useEffect(() => {
    const palette = currentPalette();
    const map = new MapLibreMap({
      container: container.current!,
      style: buildStyle(palette, features),
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

    mapRef.current = map;
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [features]);

  // Mirror the selection into feature state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const apply = () => {
      map.setFeatureState({ source: SOURCE_SHAPES, id: selectedId }, { selected: true });
      map.setFeatureState({ source: SOURCE_MARKERS, id: selectedId }, { selected: true });
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
    return () => {
      map.off('load', apply);
      if (!mapRef.current) return;
      map.setFeatureState({ source: SOURCE_SHAPES, id: selectedId }, { selected: false });
      map.setFeatureState({ source: SOURCE_MARKERS, id: selectedId }, { selected: false });
    };
  }, [selectedId]);

  // Move the camera when asked to (search, deep link), keeping clear of the panel.
  const insetRef = useRef(panelInset);
  useEffect(() => {
    insetRef.current = panelInset;
  }, [panelInset]);
  useEffect(() => {
    const map = mapRef.current;
    const country = focus && countries.get(focus.id);
    if (!map || !country) return;
    const [w, s, e, n] = country.bbox;
    const inset = insetRef.current;
    map.fitBounds(new LngLatBounds([w, s], [e, n]), {
      padding: { top: 72, left: 32, right: 32 + inset.right, bottom: 32 + inset.bottom },
      maxZoom: country.tiny ? 6 : 5,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900,
    });
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
