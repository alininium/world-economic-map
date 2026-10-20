import { INDICATORS, type CurrencyInfo, type IndicatorKey } from '../../shared/indicators';
import type { Country, DatasetMeta } from '../../shared/types';
import type { MacroIndex } from '../data/macro';
import { FigureRows } from './FigureRows';

interface Props {
  country: Country;
  macro: MacroIndex;
  /** Indicators whose sources are loaded; others say so instead of "no data". */
  loaded: ReadonlySet<IndicatorKey>;
  currencies: CurrencyInfo[] | undefined;
  currencyMeta: DatasetMeta | undefined;
}

const MACRO_DEFS = INDICATORS.filter((d) => (d.section ?? 'macro') === 'macro');

export function MacroSnapshot({ country, macro, loaded, currencies, currencyMeta }: Props) {
  return (
    <section>
      <h3>Macro snapshot</h3>
      <table className="figures">
        <tbody>
          <FigureRows defs={MACRO_DEFS} country={country} macro={macro} loaded={loaded} />
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
