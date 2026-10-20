import { useEffect, useRef } from 'react';
import { COMMODITIES, MEASURE_LABELS } from '../../shared/commodities';
import { INDICATORS, type CurrencyTable, type IndicatorKey } from '../../shared/indicators';
import type { Country } from '../../shared/types';
import type { MacroIndex } from '../data/macro';
import type { ResourceIndex } from '../data/resources';
import { formatQuantity, formatValue } from '../format';
import { FigureSource } from '../panel/FigureRows';

interface Props {
  ids: readonly string[];
  countries: ReadonlyMap<string, Country>;
  macro: MacroIndex;
  /** Indicators whose source is downloaded; others say so instead of "no data". */
  loaded: ReadonlySet<IndicatorKey>;
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
  loaded,
  resources,
  currencies,
  onRemove,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open/close effect on every parent render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  /** Where a press started, so a drag from the table onto the backdrop does not close it. */
  const pressStart = useRef<EventTarget | null>(null);

  // Once per opening: focus the dialog, keep Tab inside it, close on Escape, then restore focus.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const box = dialog.current!;
    box.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = box.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      // Focus on the container itself (as on open) counts as "not on a control yet".
      const offControls = active === box || !box.contains(active);
      if (e.shiftKey && (active === first || offControls)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || offControls)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // The opener may be gone or disabled (the tray's Compare button); fall back to search.
      const usable = opener?.isConnected && !(opener as HTMLButtonElement).disabled;
      (usable ? opener : document.getElementById('country-search'))?.focus();
    };
  }, []);

  const cols = ids.map((id) => countries.get(id)).filter((c): c is Country => !!c);
  const resourceRows = COMMODITIES.flatMap((c) =>
    (['production', 'reserves'] as const).flatMap((m) => {
      const series = resources[c.id]?.[m];
      if (!series || !cols.some((col) => series.table.values[col.id])) return [];
      return [{ commodity: c, measure: m, series }];
    }),
  );

  return (
    <div
      className="compare-backdrop"
      onPointerDown={(e) => {
        pressStart.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStart.current === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="compare"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        tabIndex={-1}
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
                          <span className="figure-value">{formatValue(fig.value, def.unit)}</span>
                        ) : (
                          <span className="missing">No data</span>
                        )}
                        <span className="figure-source compare-source">
                          <FigureSource def={def} country={c} macro={macro} loaded={loaded} />
                        </span>
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
                            <span className="figure-source compare-source">{o.year}</span>
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
