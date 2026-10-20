import {
  CATEGORY_LABELS,
  COMMODITY_BY_ID,
  MEASURE_LABELS,
  type CommodityCategory,
} from '../../shared/commodities';
import type { CountryResource } from '../data/resources';
import { formatQuantity, formatShare } from '../format';

interface Props {
  rows: readonly CountryResource[];
  /** Resource datasets loaded at all; distinguishes "none" from "not downloaded". */
  anyLoaded: boolean;
  onOpenCommodity: (id: string) => void;
}

/** Commodities the country produces, refines, holds or trades, grouped by category. */
export function ResourcesSection({ rows, anyLoaded, onOpenCommodity }: Props) {
  const groups = new Map<CommodityCategory, CountryResource[]>();
  for (const r of rows) {
    const cat = COMMODITY_BY_ID[r.commodity]!.category;
    groups.set(cat, [...(groups.get(cat) ?? []), r]);
  }
  return (
    <section>
      <h3>Strategic resources</h3>
      {!anyLoaded ? (
        <p className="missing">
          Resource data has not been downloaded yet. Run <code>npm run data:refresh resources</code>
          .
        </p>
      ) : rows.length === 0 ? (
        <p className="missing">
          Not listed as a producer, refiner, holder or trader in the loaded sources.
        </p>
      ) : (
        [...groups].map(([cat, list]) => (
          <div key={cat}>
            <h4>{CATEGORY_LABELS[cat]}</h4>
            <table className="figures">
              <tbody>
                {list.map((r) => (
                  <tr key={`${r.commodity}-${r.measure}`}>
                    <th scope="row">
                      <button
                        type="button"
                        className="link"
                        onClick={() => onOpenCommodity(r.commodity)}
                      >
                        {COMMODITY_BY_ID[r.commodity]!.label}
                      </button>{' '}
                      <span className="muted small">{MEASURE_LABELS[r.measure].toLowerCase()}</span>
                    </th>
                    <td className="figure-value">{formatQuantity(r.value, r.unit)}</td>
                    <td className="figure-source">
                      #{r.rank} of {r.of}
                      {r.share !== null && ` · ${formatShare(r.share)} of world`} · {r.year}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}
