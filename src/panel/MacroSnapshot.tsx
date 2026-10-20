import { INDICATORS, type CurrencyInfo, type IndicatorKey } from '../../shared/indicators';
import type { Country, DatasetMeta } from '../../shared/types';
import { SOURCE_LABELS, sourceLink, type MacroIndex } from '../data/macro';
import { formatValue } from '../format';

interface Props {
  country: Country;
  macro: MacroIndex;
  /** Indicators whose sources are loaded; others say so instead of "no data". */
  loaded: ReadonlySet<IndicatorKey>;
  currencies: CurrencyInfo[] | undefined;
  currencyMeta: DatasetMeta | undefined;
}

/** Older than this, a figure is flagged as possibly out of date. */
const STALE_YEARS = 4;

export function MacroSnapshot({ country, macro, loaded, currencies, currencyMeta }: Props) {
  const thisYear = new Date().getFullYear();
  return (
    <section>
      <h3>Macro snapshot</h3>
      <table className="figures">
        <tbody>
          {INDICATORS.filter((d) => (d.section ?? 'macro') === 'macro').map((def) => {
            const fig = macro[def.key][country.id];
            return (
              <tr key={def.key}>
                <th scope="row" title={def.description}>
                  {def.label}
                </th>
                <td className="figure-value">
                  {fig ? (
                    formatValue(fig.value, def.unit)
                  ) : (
                    <span className="missing">No data</span>
                  )}
                </td>
                <td className="figure-source">
                  {fig ? (
                    <>
                      <span className={thisYear - fig.year > STALE_YEARS ? 'stale' : undefined}>
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
          <tr>
            <th scope="row">Currency</th>
            <td className="figure-value">
              {currencies?.length ? (
                currencies.map((c) => `${c.name} (${c.code})`).join(', ')
              ) : (
                <span className="missing">No data</span>
              )}
            </td>
            <td className="figure-source">
              {currencyMeta ? (
                <a href={currencyMeta.sourceUrl} target="_blank" rel="noreferrer">
                  ISO 4217
                </a>
              ) : (
                'Source not loaded'
              )}
            </td>
          </tr>
        </tbody>
      </table>
      {INDICATORS.some((d) => !loaded.has(d.key)) && (
        <p className="note">
          Some sources have not been downloaded yet. Run <code>npm run data:refresh macro</code>.
        </p>
      )}
    </section>
  );
}
