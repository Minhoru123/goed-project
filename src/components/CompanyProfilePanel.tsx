import { Link } from 'react-router-dom';
import type { Company } from '../types';
import { cleanCity, normalizeUrl } from '../lib/companyMeta';

interface Props {
  company: Company;
  knownCities: readonly string[];
  compact?: boolean;
}

export default function CompanyProfilePanel({ company, knownCities, compact = false }: Props) {
  const city = cleanCity(company.city, company.address, knownCities);
  const website = normalizeUrl(company.website);
  const linkedin = normalizeUrl(company.linkedin);
  const jobsUrl = normalizeUrl(company.jobsUrl);

  return (
    <div className={`space-y-4 ${compact ? '' : 'card border-utah-gold/20'}`}>
      <div className="flex flex-col gap-4 border-b border-utah-stone/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">
            Utah startup profile
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {compact && (
              <h2 className="text-2xl font-display font-bold text-utah-stone">
                {company.name}
              </h2>
            )}
            {company.stage && (
              <span className="rounded-full border border-utah-gold/40 bg-utah-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-utah-gold">
                {company.stage}
              </span>
            )}
            {company.hiring === true && (
              <span className="rounded-full border border-utah-hiring/40 bg-utah-hiring/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-utah-hiring">
                Hiring now
              </span>
            )}
          </div>
          <p className="text-sm text-utah-stone/70">
            {[city, company.sector, company.employees].filter(Boolean).join(' · ') || 'Utah company profile'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {website && (
            <a href={website} target="_blank" rel="noreferrer" className="btn-primary text-sm">
              Visit website
            </a>
          )}
          <Link to={`/add-company?mode=claim&company=${encodeURIComponent(company.id)}`} className="btn-secondary text-sm">
            Claim or update
          </Link>
        </div>
      </div>

      {company.description && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">What they do</p>
          <p className="max-w-3xl text-base leading-relaxed text-utah-stone/85">{company.description}</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="City" value={city ?? 'Unknown'} />
        <InfoCard label="Sector" value={company.sector ?? 'Not listed'} />
        <InfoCard label="Employees" value={company.employees ?? 'Not listed'} />
        <InfoCard label="Founded" value={company.foundedYear ? String(company.foundedYear) : 'Not listed'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">Address</p>
          <p className="mt-2 text-sm text-utah-stone/85">{company.address}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs"
            >
              Open in Google Maps
            </a>
            <a
              href={`https://maps.apple.com/?q=${encodeURIComponent(company.address)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs"
            >
              Open in Apple Maps
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">Links</p>
          <div className="mt-3 space-y-2">
            {website && <LinkRow label="Website" href={website} text={website.replace(/^https?:\/\//, '').replace(/\/$/, '')} />}
            {linkedin && <LinkRow label="LinkedIn" href={linkedin} text={linkedin.replace(/^https?:\/\//, '').replace(/\/$/, '')} />}
            {jobsUrl && <LinkRow label="Jobs" href={jobsUrl} text={jobsUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} />}
            {!website && !linkedin && !jobsUrl && <p className="text-sm text-utah-stone/60">No public links listed yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">{label}</p>
      <p className="mt-2 text-sm font-medium text-utah-stone">{value}</p>
    </div>
  );
}

function LinkRow({ label, href, text }: { label: string; href: string; text: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-xl border border-utah-stone/10 bg-utah-slate/50 px-3 py-2 text-sm text-utah-stone transition hover:border-utah-gold/40 hover:text-utah-gold"
    >
      <span className="font-semibold">{label}</span>
      <span className="truncate pl-3 text-utah-stone/65">{text}</span>
    </a>
  );
}
