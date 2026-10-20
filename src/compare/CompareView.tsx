import { useEffect, useRef } from 'react';
import { COMMODITIES, MEASURE_LABELS } from '../../shared/commodities';
import { INDICATORS, type CurrencyTable } from '../../shared/indicators';
import type { Country } from '../../shared/types';
import { SOURCE_LABELS, type MacroIndex } from '../data/macro';
import type { ResourceIndex } from '../data/resources';
import { formatQuantity, formatValue } from '../format';

interface Props {
  ids: readonly string[];
  countries: ReadonlyMap<string, Country>;
  macro: MacroIndex;
  resources: ResourceIndex;
  currencies: CurrencyTable | undefined;
  onRemove: (id: string) => void;
  onClose: () => void;
}

/** Side-by-side table of the compared countries: every indicator, then shared resources. */
export function CompareView({
  ids,
  countries,
  macro,
  resources,
  currencies,
  onRemove,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  // Focus the dialog on open, keep Tab inside it, close on Escape, and restore focus on close.
  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== 'Tab' || !dialog.current) return;
      const focusable = dialog.current.querySelectorAll<HTMLElement>('button, a[href]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const cols = ids.map((id) => countries.get(id)).filter((c): c is Country => !!c);
  const resourceRows = COMMODITIES.flatMap((c) =>
    (['production', 'reserves'] as const).flatMap((m) => {
      const series = resources[c.id]?.[m];
      if (!series || !cols.some((col) => series.table.values[col.id])) return [];
      return [{ commodity: c, measure: m, series }];
    }),
  );

  return (
    <div className="compare-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        className="compare"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <h2 id="compare-title">Compare countries</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close comparison"
          >
            ×
          </button>
        </header>
        <div className="compare-scroll">
          <table className="figures compare-table">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Indicator</span>
                </th>
                {cols.map((c) => (
                  <th key={c.id} scope="col">
                    {c.name}{' '}
                    <button
                      type="button"
                      className="link small"
                      onClick={() => onRemove(c.id)}
                      aria-label={`Remove ${c.name} from comparison`}
                    >
                      remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INDICATORS.map((def) => (
                <tr key={def.key}>
                  <th scope="row" title={def.description}>
                    {def.label}
                  </th>
                  {cols.map((c) => {
                    const fig = macro[def.key][c.id];
                    return (
                      <td key={c.id}>
                        {fig ? (
                          <>
                            <span className="figure-value">{formatValue(fig.value, def.unit)}</span>
                            <span className="figure-source">
                              {' '}
                              {fig.year} · {SOURCE_LABELS[fig.source]}
                            </span>
                          </>
                        ) : (
                          <span className="missing">No data</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Currency</th>
                {cols.map((c) => (
                  <td key={c.id}>
                    {currencies?.[c.id]?.map((x) => x.code).join(', ') || (
                      <span className="missing">No data</span>
                    )}
                  </td>
                ))}
              </tr>
              {resourceRows.map(({ commodity, measure, series }) => (
                <tr key={`${commodity.id}-${measure}`}>
                  <th scope="row">
                    {commodity.label} {MEASURE_LABELS[measure].toLowerCase()}
                  </th>
                  {cols.map((c) => {
                    const o = series.table.values[c.id];
                    return (
                      <td key={c.id}>
                        {o ? (
                          <>
                            <span className="figure-value">
                              {formatQuantity(o.value, series.table.unit)}
                            </span>
                            <span className="figure-source"> {o.year}</span>
                          </>
                        ) : (
                          <span className="missing">Not listed</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="legend-note">
          Figures are each source’s latest year per country, so years can differ across a row.
        </p>
      </div>
    </div>
  );
}
