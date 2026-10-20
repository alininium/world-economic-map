import {
  CHAIN_BY_ID,
  POSITION_LABELS,
  type ChainNote,
  type ChainTradeTable,
} from '../../shared/chains';
import type { Country } from '../../shared/types';
import { netTrade, notesFor } from '../data/chains';
import { formatBreak, formatValue } from '../format';
import type { ClassBin } from '../map/choropleth';
import { LegendBins } from '../map/Legend';
import { Citations } from '../panel/Citations';

interface Props {
  chain: string;
  stage: string;
  notes: readonly ChainNote[];
  trade: ChainTradeTable | null;
  countries: ReadonlyMap<string, Country>;
  /** Map legend: diverging net-trade classes, or null when the map highlights named countries. */
  bins: readonly ClassBin[] | null;
  highlightColor: string;
  noDataColor: string;
  onStage: (stage: string) => void;
  onSelectCountry: (id: string) => void;
}

/** The production-chain view's card: stages, cited key players and, with trade data, net positions. */
export function ChainCard({
  chain,
  stage,
  notes,
  trade,
  countries,
  bins,
  highlightColor,
  noDataColor,
  onStage,
  onSelectCountry,
}: Props) {
  const def = CHAIN_BY_ID[chain]!;
  const st = def.stages.find((s) => s.id === stage) ?? def.stages[0]!;
  const stageNotes = notesFor(notes, chain, st.id);
  const stageTrade = trade?.[chain]?.[st.id];
  const ranked = stageTrade ? netTrade(stageTrade) : [];
  const name = (id: string) => countries.get(id)?.name ?? id;
  const countryLink = (id: string) => (
    <button key={id} type="button" className="link" onClick={() => onSelectCountry(id)}>
      {name(id)}
    </button>
  );
  return (
    <section className="legend commodity-card" aria-label={`${def.label} production chain`}>
      <h2>{def.label}</h2>
      <p className="legend-note">{def.description}</p>
      <ol className="chain-stages" aria-label="Stages">
        {def.stages.map((s) => (
          <li key={s.id}>
            <button type="button" aria-pressed={s.id === st.id} onClick={() => onStage(s.id)}>
              <span className="muted small">{POSITION_LABELS[s.position]}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      {stageNotes.length > 0 && (
        <>
          <h3 className="card-h">Key players (cited)</h3>
          <ul className="chain-notes">
            {stageNotes.map((n, i) => (
              <li key={i}>
                <strong>
                  {n.countries.map((c, j) => (
                    <span key={c}>
                      {j > 0 && ', '}
                      {countryLink(c)}
                    </span>
                  ))}
                </strong>
                : {n.text} {n.asOf && <span className="muted">({n.asOf})</span>}{' '}
                <Citations sources={n.sources} />
              </li>
            ))}
          </ul>
        </>
      )}
      {stageNotes.length === 0 && <p className="legend-note">No cited notes for this stage yet.</p>}

      {st.hs.length === 0 ? (
        <p className="legend-note">This stage leaves no trace in customs data.</p>
      ) : stageTrade ? (
        <>
          <h3 className="card-h">Net trade ({st.hsLabel})</h3>
          <div className="net-lists">
            <div>
              <span className="muted small">Largest net exporters</span>
              <ol className="ranking">
                {ranked
                  .filter((r) => r.net > 0)
                  .slice(0, 5)
                  .map((r) => (
                    <li key={r.id}>
                      <div className="ranking-row">
                        {countryLink(r.id)}
                        <span className="figure-value">{formatValue(r.net, 'usd')}</span>
                        <span className="muted">{r.year}</span>
                      </div>
                    </li>
                  ))}
              </ol>
            </div>
            <div>
              <span className="muted small">Largest net importers</span>
              <ol className="ranking">
                {ranked
                  .filter((r) => r.net < 0)
                  .reverse()
                  .slice(0, 5)
                  .map((r) => (
                    <li key={r.id}>
                      <div className="ranking-row">
                        {countryLink(r.id)}
                        <span className="figure-value">{formatValue(r.net, 'usd')}</span>
                        <span className="muted">{r.year}</span>
                      </div>
                    </li>
                  ))}
              </ol>
            </div>
          </div>
          {bins && (
            <LegendBins
              bins={bins}
              format={(v) => formatBreak(v, 'usd')}
              noDataColor={noDataColor}
              noDataLabel="Not reported"
            />
          )}
        </>
      ) : (
        <p className="legend-note">
          Trade by stage has not been downloaded yet (<code>npm run data:refresh trade</code>). The
          map highlights the countries named in the cited notes.
        </p>
      )}
      {!stageTrade && (
        <ul className="legend-bins">
          <li>
            <span className="swatch" style={{ background: highlightColor }} aria-hidden="true" />
            Named in a cited note for this stage
          </li>
        </ul>
      )}
    </section>
  );
}
