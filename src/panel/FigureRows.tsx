import type { IndicatorDef, IndicatorKey } from '../../shared/indicators';
import type { Country } from '../../shared/types';
import { SOURCE_LABELS, sourceLink, type MacroIndex } from '../data/macro';
import { formatValue } from '../format';

/** Older than this, a figure's year is highlighted as possibly out of date. */
export const STALE_YEARS = 4;

interface Props {
  defs: readonly IndicatorDef[];
  country: Country;
  macro: MacroIndex;
  /** Indicators whose sources are loaded; others say so instead of "no data". */
  loaded: ReadonlySet<IndicatorKey>;
}

/** Table rows for indicators: value, year (flagged when stale) and a link to the source series. */
export function FigureRows({ defs, country, macro, loaded }: Props) {
  const thisYear = new Date().getFullYear();
  return (
    <>
      {defs.map((def) => {
        const fig = macro[def.key][country.id];
        return (
          <tr key={def.key}>
            <th scope="row" title={def.description}>
              {def.label}
            </th>
            <td className="figure-value">
              {fig ? formatValue(fig.value, def.unit) : <span className="missing">No data</span>}
            </td>
            <td className="figure-source">
              {fig ? (
                <>
                  <span
                    className={thisYear - fig.year > STALE_YEARS ? 'stale' : undefined}
                    title={
                      thisYear - fig.year > STALE_YEARS ? 'More than four years old' : undefined
                    }
                  >
                    {fig.year}
                  </span>{' '}
                  ·{' '}
                  <a
                    href={sourceLink(fig.source, fig.code, country)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {SOURCE_LABELS[fig.source]}
                  </a>
                </>
              ) : loaded.has(def.key) ? (
                'Not reported'
              ) : (
                'Source not loaded'
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
