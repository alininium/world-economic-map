import { CATEGORY_LABELS, COMMODITIES, type CommodityCategory } from '../../shared/commodities';
import { INDICATORS, type IndicatorKey } from '../../shared/indicators';

export type MapMode =
  | { kind: 'political' }
  | { kind: 'indicator'; key: IndicatorKey }
  | { kind: 'commodity'; id: string };

interface Props {
  value: MapMode;
  /** Indicators with at least one figure loaded; the rest are listed but disabled. */
  available: ReadonlySet<IndicatorKey>;
  /** Commodities with at least one measure loaded. */
  commodities: ReadonlySet<string>;
  onChange: (mode: MapMode) => void;
}

const encode = (m: MapMode) =>
  m.kind === 'indicator' ? `i:${m.key}` : m.kind === 'commodity' ? `c:${m.id}` : '';

function decode(v: string): MapMode {
  if (v.startsWith('i:')) return { kind: 'indicator', key: v.slice(2) as IndicatorKey };
  if (v.startsWith('c:')) return { kind: 'commodity', id: v.slice(2) };
  return { kind: 'political' };
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as CommodityCategory[];

export function MetricPicker({ value, available, commodities, onChange }: Props) {
  return (
    <label className="metric-picker">
      <span className="visually-hidden">Colour countries by</span>
      <select value={encode(value)} onChange={(e) => onChange(decode(e.target.value))}>
        <option value="">Political map</option>
        <optgroup label="Economy">
          {INDICATORS.filter((d) => d.choropleth).map((d) => (
            <option key={d.key} value={`i:${d.key}`} disabled={!available.has(d.key)}>
              {d.label}
              {available.has(d.key) ? '' : ' (no data loaded)'}
            </option>
          ))}
        </optgroup>
        {CATEGORIES.map((cat) => (
          <optgroup key={cat} label={`Resources: ${CATEGORY_LABELS[cat]}`}>
            {COMMODITIES.filter((c) => c.category === cat).map((c) => (
              <option key={c.id} value={`c:${c.id}`} disabled={!commodities.has(c.id)}>
                {c.label}
                {commodities.has(c.id) ? '' : ' (no data loaded)'}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
