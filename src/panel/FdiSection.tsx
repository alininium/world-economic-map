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
import { SOURCE_LABELS, sourceLink, type MacroIndex } from '../data/macro';
import { formatBreak, formatValue } from '../format';

interface Props {
  country: Country;
  macro: MacroIndex;
  /** Indicators whose source is downloaded; others say so instead of "no data". */
  loaded: ReadonlySet<IndicatorKey>;
  manifest: Manifest;
  darkMode: boolean;
  colors: { inflows: string; outflows: string };
}

const FDI = INDICATORS.filter((d) => d.section === 'fdi');
const IN = INDICATOR_BY_KEY.fdiInflows.series[0]!.code;
const OUT = INDICATOR_BY_KEY.fdiOutflows.series[0]!.code;

/** Foreign direct investment flows: latest figures and a ten-year history. Lazy-loaded with ECharts. */
export default function FdiSection({ country, macro, loaded, manifest, darkMode, colors }: Props) {
  const [history, setHistory] = useState<Dataset<HistoryTable> | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    loadHistory(manifest).then(
      (h) => !cancelled && setHistory(h),
      () => !cancelled && setHistory(null),
    );
    return () => {
      cancelled = true;
    };
  }, [manifest]);

  const series: YearSeries[] = useMemo(() => {
    const pick = (code: string) =>
      new Map((history?.data[code]?.[country.id] ?? []).map((o) => [o.year, o.value]));
    return [
      { name: 'Inflows', color: colors.inflows, values: pick(IN) },
      { name: 'Outflows', color: colors.outflows, values: pick(OUT) },
    ];
  }, [history, country.id, colors]);
  const hasHistory = series.some((s) => s.values.size > 0);
  const inflow = macro.fdiInflows[country.id];
  const outflow = macro.fdiOutflows[country.id];

  return (
    <section>
      <h3>Foreign investment</h3>
      <table className="figures">
        <tbody>
          {FDI.map((def) => {
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
                  {!fig && (loaded.has(def.key) ? 'Not reported' : 'Source not loaded')}
                  {fig && (
                    <>
                      {fig.year} ·{' '}
                      <a
                        href={sourceLink(fig.source, fig.code, country)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {SOURCE_LABELS[fig.source]}
                      </a>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
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
      {hasHistory && (
        <>
          <h4>Last ten years (World Bank, balance of payments)</h4>
          <YearBars
            series={series}
            format={(v) => formatBreak(v, 'usd')}
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
