import type { Country } from '../../shared/types';
import { MAX_COMPARE } from './compare';

interface Props {
  ids: readonly string[];
  countries: ReadonlyMap<string, Country>;
  onRemove: (id: string) => void;
  onOpen: () => void;
}

/** Bar listing the countries picked for comparison, with a button to open the table. */
export function CompareTray({ ids, countries, onRemove, onOpen }: Props) {
  if (!ids.length) return null;
  return (
    <section className="compare-tray" aria-label="Comparison">
      <span className="muted small">
        Compare ({ids.length}/{MAX_COMPARE}):
      </span>
      {ids.map((id) => (
        <span key={id} className="chip">
          {countries.get(id)?.name ?? id}
          <button
            type="button"
            onClick={() => onRemove(id)}
            aria-label={`Remove ${countries.get(id)?.name ?? id}`}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className="primary" onClick={onOpen} disabled={ids.length < 2}>
        Compare
      </button>
    </section>
  );
}
