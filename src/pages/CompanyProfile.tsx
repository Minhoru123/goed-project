import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import CompanyProfilePanel from '../components/CompanyProfilePanel';
import { loadCompanies } from '../lib/loadData';
import { getKnownCities } from '../lib/companyMeta';
import type { Company } from '../types';

export default function CompanyProfile() {
  const { id } = useParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies()
      .then(setCompanies)
      .catch((e: Error) => setError(e.message));
  }, []);

  const company = useMemo(() => companies.find((entry) => entry.id === id) ?? null, [companies, id]);
  const knownCities = useMemo(() => getKnownCities(companies), [companies]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="card border-utah-red/40 bg-utah-red/5 text-sm text-utah-red">
          Could not load company profiles. ({error})
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Company directory</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Company not found</h1>
          <p className="mt-3 max-w-2xl text-base text-utah-stone/75">
            This profile may not exist yet, or the listing id changed.
          </p>
        </div>
        <Link to="/map" className="btn-primary text-sm">
          Back to startup map
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Company directory</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Dedicated profile page</h1>
          <p className="mt-3 max-w-2xl text-base text-utah-stone/75">
            Rich company profiles are now available outside the map popup so operators, founders, and investors can share a stable URL.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/map" className="btn-secondary text-sm">
            Back to map
          </Link>
          <Link to={`/add-company?mode=claim&company=${encodeURIComponent(company.id)}`} className="btn-primary text-sm">
            Claim or update this page
          </Link>
        </div>
      </div>
      <CompanyProfilePanel company={company} knownCities={knownCities} />
    </div>
  );
}
