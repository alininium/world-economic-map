import { CHAIN_BY_ID, CHAINS, type ChainNote } from '../../shared/chains';
import type { CountryStageRole } from '../data/chains';
import { formatValue } from '../format';
import { Citations } from './Citations';

interface Props {
  notes: readonly ChainNote[];
  roles: readonly CountryStageRole[];
  notesLoaded: boolean;
  tradeLoaded: boolean;
  onOpenChain: (chain: string, stage: string) => void;
}

/** Where the country sits in each production chain: cited notes and net trade by stage. */
export function ChainSection({ notes, roles, notesLoaded, tradeLoaded, onOpenChain }: Props) {
  const chains = CHAINS.filter(
    (c) => notes.some((n) => n.chain === c.id) || roles.some((r) => r.chain === c.id),
  );
  const stageLabel = (chain: string, stage: string) =>
    CHAIN_BY_ID[chain]!.stages.find((s) => s.id === stage)?.label ?? stage;
  return (
    <section>
      <h3>Production chains</h3>
      {!notesLoaded && !tradeLoaded && (
        <p className="missing">
          Chain data has not been built yet. Run <code>npm run data:refresh chains</code>.
        </p>
      )}
      {(notesLoaded || tradeLoaded) && chains.length === 0 && (
        <p className="missing">
          Not named in the cited notes{tradeLoaded ? ' and no stage trade reported' : ''}.
        </p>
      )}
      {chains.map((c) => (
        <div key={c.id}>
          <h4>{c.label}</h4>
          <ul className="chain-notes">
            {notes
              .filter((n) => n.chain === c.id)
              .map((n, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onOpenChain(n.chain, n.stage)}
                  >
                    {stageLabel(n.chain, n.stage)}
                  </button>
                  : {n.text} {n.asOf && <span className="muted">({n.asOf})</span>}{' '}
                  <Citations sources={n.sources} />
                </li>
              ))}
          </ul>
          {roles.some((r) => r.chain === c.id) && (
            <table className="figures">
              <tbody>
                {roles
                  .filter((r) => r.chain === c.id)
                  .map((r) => (
                    <tr key={r.stage}>
                      <th scope="row">
                        <button
                          type="button"
                          className="link"
                          onClick={() => onOpenChain(r.chain, r.stage)}
                        >
                          {stageLabel(r.chain, r.stage)}
                        </button>
                      </th>
                      <td className="figure-value">
                        {r.net >= 0 ? 'Net exporter' : 'Net importer'}{' '}
                        {formatValue(Math.abs(r.net), 'usd')}
                      </td>
                      <td className="figure-source">{r.year} · UN Comtrade</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {!tradeLoaded && notesLoaded && (
        <p className="note">
          Trade-derived roles by stage appear once trade data is downloaded (
          <code>npm run data:refresh trade</code>).
        </p>
      )}
    </section>
  );
}
