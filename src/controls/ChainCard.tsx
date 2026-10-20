import { CHAIN_BY_ID, POSITION_LABELS, type ChainNote } from '../../shared/chains';
import type { Country } from '../../shared/types';
import { notesFor, type NetTrade } from '../data/chains';
import { formatBreak, formatValue } from '../format';
import type { ClassBin } from '../map/choropleth';
import { LegendBins } from '../map/Legend';
import { Citations } from '../panel/Citations';

interface Props {
  chain: string;
  stage: string;
  notes: readonly ChainNote[];
  /** Net trade for the stage, sovereign states only, largest net exporter first; null without trade data. */
  ranked: readonly NetTrade[] | null;
  countries: ReadonlyMap<string, Country>;
  /** Diverging net-trade classes, or null when the map highlights the countries notes name. */
  bins: readonly ClassBin[] | null;
  supplierColor: string;
  dependentColor: string;
  noDataColor: string;
  onStage: (stage: string) => void;
  onSelectCountry: (id: string) => void;
}

/** The production-chain view's card: stages, cited notes and, with trade data, net positions. */
export function ChainCard({
  chain,
  stage,
  notes,
  ranked,
  countries,
  bins,
  supplierColor,
  dependentColor,
  noDataColor,
  onStage,
  onSelectCountry,
}: Props) {
  const def = CHAIN_BY_ID[chain]!;
  const st = def.stages.find((s) => s.id === stage) ?? def.stages[0]!;
  const stageNotes = notesFor(notes, chain, st.id);
  const countryLinks = (ids: readonly string[]) =>
    ids.map((id, j) => (
      <span key={id}>
        {j > 0 && ', '}
        <button type="button" className="link" onClick={() => onSelectCountry(id)}>
          {countries.get(id)?.name ?? id}
        </button>
      </span>
    ));
  const rankRow = (r: NetTrade) => (
    <li key={r.id}>
      <div className="ranking-row">
        <button type="button" className="link" onClick={() => onSelectCountry(r.id)}>
          {countries.get(r.id)?.name ?? r.id}
        </button>
        <span className="figure-value">{formatValue(r.net, 'usd')}</span>
        <span className="muted">{r.year}</span>
      </div>
    </li>
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

      {stageNotes.length > 0 ? (
        <>
          <h3 className="card-h">What the sources say</h3>
          <ul className="chain-notes">
            {stageNotes.map((n, i) => (
              <li key={i}>
                {n.countries.length > 0 && <strong>{countryLinks(n.countries)}</strong>}
                {n.dependents?.length ? (
                  <>
                    {n.countries.length > 0 && ' → '}
                    <span className="muted">relying: </span>
                    {countryLinks(n.dependents)}
                  </>
                ) : null}
                : {n.text} {n.asOf && <span className="muted">({n.asOf})</span>}{' '}
                <Citations sources={n.sources} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="legend-note">No cited notes for this stage yet.</p>
      )}

      {st.hs.length === 0 ? (
        <p className="legend-note">This stage leaves no trace in customs data.</p>
      ) : ranked ? (
        <>
          <h3 className="card-h">Net trade ({st.hsLabel})</h3>
          <div className="net-lists">
            <span className="muted small">Largest net exporters</span>
            <ol className="ranking">
              {ranked
                .filter((r) => r.net > 0)
                .slice(0, 5)
                .map(rankRow)}
            </ol>
            <span className="muted small">Largest net importers</span>
            <ol className="ranking">
              {ranked
                .filter((r) => r.net < 0)
                .reverse()
                .slice(0, 5)
                .map(rankRow)}
            </ol>
          </div>
          {bins && (
            <LegendBins
              bins={bins}
              format={(v) => formatBreak(v, 'usd')}
              noDataColor={noDataColor}
              noDataLabel="Not reported"
            />
          )}
          <p className="legend-note">
            Sovereign states; each country’s latest year with both flows.
          </p>
        </>
      ) : (
        <>
          <p className="legend-note">
            Trade by stage has not been downloaded yet (<code>npm run data:refresh trade</code>).
            The map shows the countries the cited notes name for this stage.
          </p>
          <ul className="legend-bins">
            <li>
              <span className="swatch" style={{ background: supplierColor }} aria-hidden="true" />
              Named as producer or supplier
            </li>
            <li>
              <span className="swatch" style={{ background: dependentColor }} aria-hidden="true" />
              Named as relying on others
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
