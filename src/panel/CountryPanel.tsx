import type { Ref } from 'react';
import { STATUS_LABELS } from '../../shared/status';
import type { Country, DatasetMeta } from '../../shared/types';

interface Props {
  ref?: Ref<HTMLElement>;
  country: Country;
  sovereign: Country | undefined;
  boundariesMeta: DatasetMeta;
  onClose: () => void;
  onSelect: (id: string) => void;
}

const STATUS_NOTES: Partial<Record<Country['status'], string>> = {
  partially_recognized:
    'Shown as a separate entity because it has its own economic statistics; recognition by other states is partial.',
  disputed: 'Sovereignty is disputed. Shown hatched and excluded from rankings.',
  dependency:
    'Shown with its own data where available, but excluded from sovereign-state rankings.',
};

export function CountryPanel({
  ref,
  country,
  sovereign,
  boundariesMeta,
  onClose,
  onSelect,
}: Props) {
  const note = STATUS_NOTES[country.status];
  return (
    <aside ref={ref} className="panel" aria-labelledby="panel-title">
      <header className="panel-header">
        <div>
          <h2 id="panel-title">{country.name}</h2>
          {country.formalName && country.formalName !== country.name && (
            <p className="muted">{country.formalName}</p>
          )}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </header>

      <section>
        <dl className="facts">
          <dt>Status</dt>
          <dd>
            <span className={`badge badge-${country.status}`}>{STATUS_LABELS[country.status]}</span>
          </dd>
          {sovereign && (
            <>
              <dt>Administered by</dt>
              <dd>
                <button type="button" className="link" onClick={() => onSelect(sovereign.id)}>
                  {sovereign.name}
                </button>
              </dd>
            </>
          )}
          <dt>Region</dt>
          <dd>{[country.subregion, country.region].filter(Boolean).join(', ') || '—'}</dd>
          <dt>Codes</dt>
          <dd>{[country.iso3 ?? country.id, country.iso2].filter(Boolean).join(' · ')}</dd>
        </dl>
        {note && <p className="note">{note}</p>}
      </section>

      <section>
        <h3>Economy</h3>
        <p className="missing">No economic datasets are loaded yet.</p>
      </section>

      <footer className="panel-footer muted">
        Boundaries: {boundariesMeta.source}, retrieved {boundariesMeta.retrievedAt}.{' '}
        {boundariesMeta.license}.
      </footer>
    </aside>
  );
}
