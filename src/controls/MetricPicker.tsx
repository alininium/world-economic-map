import { INDICATORS, type IndicatorKey } from '../../shared/indicators';

interface Props {
  value: IndicatorKey | null;
  /** Metrics with at least one figure loaded; the rest are listed but disabled. */
  available: ReadonlySet<IndicatorKey>;
  onChange: (key: IndicatorKey | null) => void;
}

export function MetricPicker({ value, available, onChange }: Props) {
  return (
    <label className="metric-picker">
      <span className="visually-hidden">Colour countries by</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as IndicatorKey | null)}
      >
        <option value="">Political map</option>
        {INDICATORS.filter((d) => d.choropleth).map((d) => (
          <option key={d.key} value={d.key} disabled={!available.has(d.key)}>
            {d.label}
            {available.has(d.key) ? '' : ' (no data loaded)'}
          </option>
        ))}
      </select>
    </label>
  );
}
