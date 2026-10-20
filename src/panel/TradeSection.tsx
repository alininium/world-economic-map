import { useMemo, useState } from 'react';
import type { TradeEntry, TradeProfile } from '../../shared/trade';
import type { DatasetMeta } from '../../shared/types';
import { BarChart, type BarItem } from '../charts/BarChart';
import { formatValue } from '../format';

interface Props {
  profile: TradeProfile | null;
  /** Set when the profile failed to load (network or server error), as opposed to not existing. */
  error?: string;
  onRetry: () => void;
  meta: DatasetMeta | undefined;
  darkMode: boolean;
  colors: { exports: string; imports: string };
  showFlows: boolean;
  onShowFlows: (show: boolean) => void;
}

type Flow = 'exports' | 'imports';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const pct = (share: number) => `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;

function toBars(entries: readonly TradeEntry[]): BarItem[] {
  return entries.map((e) => ({
    label: e.name,
    value: e.value,
    note: pct(e.share),
    // ECharts renders tooltips as HTML; source names can contain '<' or '&'.
    detail: `${escapeHtml(e.name)}<br/>${formatValue(e.value, 'usd')} · ${pct(e.share)}`,
  }));
}

function EntryTable({ entries, caption }: { entries: readonly TradeEntry[]; caption: string }) {
  return (
    <table className="figures">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Value</th>
          <th scope="col">Share</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.code}>
            <td>{e.name}</td>
            <td className="figure-value">{formatValue(e.value, 'usd')}</td>
            <td>{pct(e.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Top products and partners for one flow, as bar charts or tables. Lazy-loaded with ECharts. */
export default function TradeSection({
  profile,
  error,
  onRetry,
  meta,
  darkMode,
  colors,
  showFlows,
  onShowFlows,
}: Props) {
  const [flow, setFlow] = useState<Flow>('exports');
  const [asTable, setAsTable] = useState(false);
  const side = profile?.[flow];
  const productBars = useMemo(() => toBars(side?.products ?? []), [side]);
  const partnerBars = useMemo(() => toBars(side?.partners ?? []), [side]);

  if (!meta) {
    return (
      <section>
        <h3>Trade in goods</h3>
        <p className="missing">
          Trade data has not been downloaded yet. Run <code>npm run data:refresh trade</code>.
        </p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        <h3>Trade in goods</h3>
        <p className="missing">Could not load trade data ({error}).</p>
        <button type="button" className="link" onClick={onRetry}>
          Retry
        </button>
      </section>
    );
  }
  if (!profile || !side) {
    return (
      <section>
        <h3>Trade in goods</h3>
        <p className="missing">No recent report to UN Comtrade for this country.</p>
      </section>
    );
  }

  const balance =
    profile.exports.total !== null && profile.imports.total !== null
      ? profile.exports.total - profile.imports.total
      : null;
  const label = flow === 'exports' ? 'Exports' : 'Imports';
  return (
    <section>
      <h3>Trade in goods</h3>
      <p className="muted small">
        {profile.year} ·{' '}
        <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
          UN Comtrade
        </a>{' '}
        (as reported; exports FOB, imports CIF)
      </p>
      <dl className="facts">
        <dt>Exports</dt>
        <dd>{formatValue(profile.exports.total, 'usd')}</dd>
        <dt>Imports</dt>
        <dd>{formatValue(profile.imports.total, 'usd')}</dd>
        <dt>Goods balance</dt>
        <dd>{formatValue(balance, 'usd')}</dd>
      </dl>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Trade flow">
          {(['exports', 'imports'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={flow === f} onClick={() => setFlow(f)}>
              {f === 'exports' ? 'Exports' : 'Imports'}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={asTable} onChange={(e) => setAsTable(e.target.checked)} />
          Table
        </label>
      </div>

      {side.total === null ? (
        <p className="missing">
          {label} were not reported for {profile.year}.
        </p>
      ) : (
        <>
          <h4>Top products (HS 4-digit)</h4>
          {side.products.length === 0 ? (
            <p className="missing">No product breakdown reported.</p>
          ) : asTable ? (
            <EntryTable entries={side.products} caption={`Top ${flow} products`} />
          ) : (
            <BarChart
              items={productBars}
              color={colors[flow]}
              darkMode={darkMode}
              ariaLabel={`Top ${flow} products by value`}
            />
          )}
          <h4>Top partners</h4>
          {side.partners.length === 0 ? (
            <p className="missing">No partner breakdown reported.</p>
          ) : asTable ? (
            <EntryTable entries={side.partners} caption={`Top ${flow} partners`} />
          ) : (
            <BarChart
              items={partnerBars}
              color={colors[flow]}
              darkMode={darkMode}
              ariaLabel={`Top ${flow} partners by value`}
            />
          )}
        </>
      )}

      <label className="check flows-toggle">
        <input
          type="checkbox"
          checked={showFlows}
          onChange={(e) => onShowFlows(e.target.checked)}
        />
        Show trade flows on the map
      </label>
      {showFlows && (
        <p className="flow-key small">
          <span className="key-line" style={{ background: colors.exports }} aria-hidden="true" />
          Top 5 export destinations
          <span className="key-line" style={{ background: colors.imports }} aria-hidden="true" />
          Top 5 import origins
        </p>
      )}
    </section>
  );
}
