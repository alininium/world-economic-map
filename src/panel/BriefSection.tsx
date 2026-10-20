import type { Brief } from '../../shared/briefs';
import type { DatasetMeta } from '../../shared/types';
import { Citations } from './Citations';

interface Props {
  brief: Brief | undefined;
  loaded: boolean;
  meta: DatasetMeta | undefined;
}

/** "Economy at a glance": the country's hand-written brief and the sources behind it. */
export function BriefSection({ brief, loaded, meta }: Props) {
  return (
    <section className="brief" aria-labelledby="brief-title">
      <h3 id="brief-title">Economy at a glance</h3>
      {!loaded ? (
        <p className="missing">
          Briefs have not been built yet. Run <code>npm run data:refresh briefs</code>.
        </p>
      ) : !brief ? (
        <p className="missing">No brief has been written for this entity yet.</p>
      ) : (
        <>
          <p className="brief-text">{brief.text}</p>
          <p className="citations">
            Sources: <Citations sources={brief.sources} />
            {meta && <> · built {meta.retrievedAt}</>}
          </p>
        </>
      )}
    </section>
  );
}
