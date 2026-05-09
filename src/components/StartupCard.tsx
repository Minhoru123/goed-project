import { Link } from 'react-router-dom';
import type { Company } from '../types';
import { normalizeUrl } from '../lib/companyMeta';

interface Props {
  company: Company;
  cityLabel?: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function StartupCard({ company, cityLabel, selected, onSelect }: Props) {
  const website = normalizeUrl(company.website);

  return (
    <button
      type="button"
      onClick={() => onSelect(company.id)}
      className={`block w-full text-left rounded-lg border p-3 transition ${
        selected
          ? 'border-utah-red bg-utah-red/5 shadow-sm'
          : 'border-utah-stone/10 bg-utah-slate hover:border-utah-stone/30 hover:bg-utah-stone/5'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-utah-stone">{company.name}</div>
        {company.stage && (
          <span className="shrink-0 rounded-full bg-utah-dark/35/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-utah-stone">
            {company.stage}
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-utah-stone/80">
        {[cityLabel ?? company.city, company.sector, company.employees].filter(Boolean).join(' · ')}
      </div>
      {company.description && (
        <p className="mt-2 text-xs leading-snug text-utah-stone/80 line-clamp-3">{company.description}</p>
      )}
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-block text-xs text-utah-sky hover:underline"
        >
          {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-utah-stone/80">
          {selected ? 'Selected on map' : 'Open on map'}
        </span>
        <Link
          to={`/companies/${company.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-semibold text-utah-gold hover:underline"
        >
          Full profile
        </Link>
      </div>
    </button>
  );
}
