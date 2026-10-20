import { useEffect, useMemo, useState } from 'react';
import {
  INDICATOR_BY_KEY,
  INDICATORS,
  type HistoryTable,
  type IndicatorKey,
} from '../../shared/indicators';
import type { Country, Dataset, Manifest } from '../../shared/types';
import { YearBars, type YearSeries } from '../charts/YearBars';
import { loadHistory } from '../data/load';
import type { MacroIndex } from '../data/macro';
import { formatBreak, formatValue } from '../format';
import { FigureRows } from './FigureRows';

interface Props {
  country: Country;
  macro: MacroIndex;
  /** Indicators whose source is downloaded; others say so instead of "no data". */
  loaded: ReadonlySet<IndicatorKey>;
  manifest: Manifest;
  darkMode: boolean;
  inflowColor: string;
  outflowColor: string;
}

const FDI_DEFS = INDICATORS.filter((d) => d.section === 'fdi');
const IN = INDICATOR_BY_KEY.fdiInflows.series[0]!.code;
const OUT = INDICATOR_BY_KEY.fdiOutflows.series[0]!.code;
const formatUsdAxis = (v: number) => formatBreak(v, 'usd');

type HistoryState =
  | { status: 'loading' }
  | { status: 'ready'; data: Dataset<HistoryTable> | null }
  | { status: 'error'; message: string };

/** Foreign direct investment flows: latest figures and a yearly history. Lazy-loaded with ECharts. */
export default function FdiSection({
  country,
  macro,
  loaded,
  manifest,
  darkMode,
  inflowColor,
  outflowColor,
}: Props) {
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadHistory(manifest).then(
      (data) => !cancelled && setHistory({ status: 'ready', data }),
      (err: Error) => !cancelled && setHistory({ status: 'error', message: err.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [manifest, attempt]);

  const data = history.status === 'ready' ? history.data : null;
  const series: YearSeries[] = useMemo(() => {
    const pick = (code: string) =>
      new Map((data?.data[code]?.[country.id] ?? []).map((o) => [o.year, o.value]));
    return [
      { name: 'Inflows', color: inflowColor, values: pick(IN) },
      { name: 'Outflows', color: outflowColor, values: pick(OUT) },
    ];
  }, [data, country.id, inflowColor, outflowColor]);
  const years = series.flatMap((s) => [...s.values.keys()]);
  const inflow = macro.fdiInflows[country.id];
  const outflow = macro.fdiOutflows[country.id];

  return (
    <section>
      <h3>Foreign investment</h3>
      <table className="figures">
        <tbody>
          <FigureRows defs={FDI_DEFS} country={country} macro={macro} loaded={loaded} />
          {inflow && outflow && inflow.year === outflow.year && (
            <tr>
              <th scope="row" title="Inflows minus outflows, same year">
                Net (in − out)
              </th>
              <td className="figure-value">{formatValue(inflow.value - outflow.value, 'usd')}</td>
              <td className="figure-source">{inflow.year}</td>
            </tr>
          )}
        </tbody>
      </table>

      {history.status === 'error' && (
        <p className="missing">
          Could not load the FDI history ({history.message}).{' '}
          <button type="button" className="link" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </p>
      )}
      {history.status === 'ready' && !data && (
        <p className="missing">
          FDI history has not been downloaded yet. Run <code>npm run data:refresh worldbank</code>.
        </p>
      )}
      {years.length > 0 && (
        <>
          <h4>
            {Math.min(...years)}–{Math.max(...years)} (World Bank, balance of payments)
          </h4>
          <YearBars
            series={series}
            format={formatUsdAxis}
            darkMode={darkMode}
            ariaLabel={`FDI inflows and outflows of ${country.name} by year`}
          />
        </>
      )}
      <p className="note">
        FDI stock and the breakdown by investor and destination country are not shown yet: the
        sources that publish them (IMF Direct Investment Positions, UNCTAD) could not be reached to
        verify their formats. See the README.
      </p>
    </section>
  );
}
