import { COMMODITY_BY_ID, MEASURE_LABELS, MEASURES, type Measure } from '../../shared/commodities';
import type { Country } from '../../shared/types';
import type { ResourceIndex } from '../data/resources';
import { ranking } from '../data/resources';
import { formatQuantity, formatShare } from '../format';
import type { ClassBin } from '../map/choropleth';

interface Props {
  commodity: string;
  measure: Measure;
  index: ResourceIndex;
  countries: ReadonlyMap<string, Country>;
  isRanked: (id: string) => boolean;
  bins: readonly ClassBin[];
  noDataColor: string;
  onMeasure: (m: Measure) => void;
  onSelectCountry: (id: string) => void;
}

/** The commodity view's side card: measure switch, legend and top-10 ranking. */
export function CommodityCard({
  commodity,
  measure,
  index,
  countries,
  isRanked,
  bins,
  noDataColor,
  onMeasure,
  onSelectCountry,
}: Props) {
  const def = COMMODITY_BY_ID[commodity]!;
  const series = index[commodity]?.[measure];
  const top = series ? ranking(series.table, isRanked).slice(0, 10) : [];
  return (
    <section
      className="legend commodity-card"
      aria-label={`${def.label}: ${MEASURE_LABELS[measure]}`}
    >
      <h2>{def.label}</h2>
      <p className="legend-note">{def.description}</p>
      <div className="segmented wrap" role="group" aria-label="Measure">
        {MEASURES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === measure}
            disabled={!index[commodity]?.[m]}
            onClick={() => onMeasure(m)}
          >
            {MEASURE_LABELS[m]}
          </button>
        ))}
      </div>
      {!series ? (
        <p className="missing">
          Not available for {def.label.toLowerCase()} from the loaded sources.
        </p>
      ) : (
        <>
          <ol className="ranking">
            {top.map((r) => (
              <li key={r.id}>
                <div className="ranking-row">
                  <button type="button" className="link" onClick={() => onSelectCountry(r.id)}>
                    {countries.get(r.id)?.name ?? r.id}
                  </button>
                  <span className="figure-value">{formatQuantity(r.value, series.table.unit)}</span>
                  <span className="muted">{r.share !== null ? formatShare(r.share) : r.year}</span>
                </div>
              </li>
            ))}
          </ol>
          <ul className="legend-bins">
            {bins.map((b) => (
              <li key={`${b.min}-${b.max}`}>
                <span className="swatch" style={{ background: b.color }} aria-hidden="true" />
                {b.min === -Infinity
                  ? `< ${formatQuantity(b.max, series.table.unit)}`
                  : b.max === Infinity
                    ? `≥ ${formatQuantity(b.min, series.table.unit)}`
                    : `${formatQuantity(b.min, series.table.unit)} to ${formatQuantity(b.max, series.table.unit)}`}
              </li>
            ))}
            <li>
              <span className="swatch" style={{ background: noDataColor }} aria-hidden="true" />
              Not listed / no data
            </li>
          </ul>
          <p className="legend-note">
            {series.table.note && `${series.table.note} `}
            Source:{' '}
            <a href={series.meta.sourceUrl} target="_blank" rel="noreferrer">
              {series.meta.source}
            </a>
            . Shares are of the source’s world total for the same year.
          </p>
        </>
      )}
      {def.note && <p className="legend-note">{def.note}</p>}
    </section>
  );
}
