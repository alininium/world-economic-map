import type { IndicatorDef } from '../../shared/indicators';
import { SOURCE_LABELS, type Figure } from '../data/macro';
import { formatBreak } from '../format';
import type { ClassBin } from './choropleth';

interface Props {
  def: IndicatorDef;
  bins: readonly ClassBin[];
  noDataColor: string;
  /** Figures shown on the map, for the year range and source summary. */
  figures: readonly Figure[];
}

function binLabel(b: ClassBin, def: IndicatorDef): string {
  const f = (v: number) => formatBreak(v, def.unit);
  if (b.min === -Infinity && b.max === Infinity) return 'All values';
  if (b.min === -Infinity) return `< ${f(b.max)}`;
  if (b.max === Infinity) return `≥ ${f(b.min)}`;
  return `${f(b.min)} to ${f(b.max)}`;
}

export function Legend({ def, bins, noDataColor, figures }: Props) {
  const years = figures.map((f) => f.year);
  const sources = new Map<string, number>();
  for (const f of figures) {
    const label = SOURCE_LABELS[f.source];
    sources.set(label, (sources.get(label) ?? 0) + 1);
  }
  const sourceText = [...sources]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n], i) => (i === 0 ? label : `${label} for ${n}`))
    .join('; ');
  return (
    <section className="legend" aria-label={`Legend: ${def.label}`}>
      <h2>{def.label}</h2>
      <ul>
        {bins.map((b) => (
          <li key={`${b.min}-${b.max}`}>
            <span className="swatch" style={{ background: b.color }} aria-hidden="true" />
            {binLabel(b, def)}
          </li>
        ))}
        <li>
          <span className="swatch" style={{ background: noDataColor }} aria-hidden="true" />
          No data
        </li>
      </ul>
      <p className="legend-note">
        Quantile classes across sovereign states.
        {years.length > 0 &&
          ` Latest year per country: ${Math.min(...years)}–${Math.max(...years)}.`}
        {sourceText && ` Source: ${sourceText}.`}
      </p>
    </section>
  );
}
