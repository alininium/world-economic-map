import type { Citation } from '../../shared/chains';

/** Compact source list for a note: "Authors (year), Venue", each linked. */
export function Citations({ sources }: { sources: readonly Citation[] }) {
  return (
    <span className="citations">
      {sources.map((s, i) => (
        <span key={`${i}-${s.url}`}>
          {i > 0 && '; '}
          <a href={s.url} target="_blank" rel="noreferrer" title={s.title}>
            {s.authors} ({s.year}), <i>{s.venue}</i>
          </a>
        </span>
      ))}
    </span>
  );
}
