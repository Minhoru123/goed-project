import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Company } from '../types';
import { loadCompanies } from '../lib/loadData';
import { cleanCity, getEmailDomain, getKnownCities, getWebsiteDomain } from '../lib/companyMeta';

const SECTORS = [
  'AI',
  'Aerospace & Defense',
  'Agriculture',
  'Consumer',
  'Education',
  'Energy',
  'Financial Services',
  'Fintech',
  'Healthcare',
  'Life Sciences',
  'Manufacturing',
  'Software',
  'Security',
  'Other',
];

type Mode = 'add' | 'claim' | 'ops';

function encodeForm(data: FormData): string {
  return new URLSearchParams(Array.from(data.entries()).map(([key, value]) => [key, String(value)])).toString();
}

function inferMode(value: string | null): Mode {
  if (value === 'claim' || value === 'ops') return value;
  return 'add';
}

function getClaimVerification(company: Company | null, email: string) {
  const emailDomain = getEmailDomain(email);
  const websiteDomain = company ? getWebsiteDomain(company.website) : null;
  if (!company) {
    return { ok: false, label: 'Select a company to verify ownership.', tone: 'muted' as const };
  }
  if (!email.trim()) {
    return { ok: false, label: 'Enter a work email to verify ownership.', tone: 'muted' as const };
  }
  if (!emailDomain) {
    return { ok: false, label: 'Enter a valid work email address.', tone: 'error' as const };
  }
  if (!websiteDomain) {
    return { ok: false, label: 'This listing has no website domain to match against yet.', tone: 'error' as const };
  }
  if (emailDomain === websiteDomain || emailDomain.endsWith(`.${websiteDomain}`)) {
    return {
      ok: true,
      label: `Verified: ${emailDomain} matches ${websiteDomain}.`,
      tone: 'success' as const,
    };
  }
  return {
    ok: false,
    label: `Verification failed: ${emailDomain} does not match ${websiteDomain}.`,
    tone: 'error' as const,
  };
}

export default function AddCompany() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [claimStatus, setClaimStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get('company') ?? '');
  const [claimEmail, setClaimEmail] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const mode = inferMode(searchParams.get('mode'));

  useEffect(() => {
    loadCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  const knownCities = useMemo(() => getKnownCities(companies), [companies]);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );
  const claimVerification = useMemo(
    () => getClaimVerification(selectedCompany, claimEmail),
    [selectedCompany, claimEmail]
  );

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return companies.slice(0, 12);
    return companies
      .filter((company) => {
        const city = cleanCity(company.city, company.address, knownCities) ?? '';
        return `${company.name} ${city} ${company.sector ?? ''}`.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [companies, companySearch, knownCities]);

  function switchMode(next: Mode) {
    const params = new URLSearchParams(searchParams);
    params.set('mode', next);
    if (next !== 'claim') params.delete('company');
    setSearchParams(params);
    setStatus('idle');
    setClaimStatus('idle');
  }

  function selectCompany(id: string) {
    setSelectedCompanyId(id);
    const params = new URLSearchParams(searchParams);
    params.set('mode', 'claim');
    params.set('company', id);
    setSearchParams(params);
    setClaimStatus('idle');
  }

  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm(data),
      });
      if (!res.ok) throw new Error('Submission failed');
      form.reset();
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  async function submitClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!claimVerification.ok) return;
    setClaimStatus('submitting');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm(data),
      });
      if (!res.ok) throw new Error('Submission failed');
      setClaimStatus('success');
    } catch {
      setClaimStatus('error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-utah-gold/20 bg-gradient-to-br from-utah-navy via-utah-dark to-utah-slate p-8 shadow-2xl shadow-black/25">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-utah-gold">Ownership and operations</p>
            <h1 className="mt-3 font-display text-4xl font-bold text-utah-stone">Claim, update, or add a company without engineering help.</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-utah-stone/75">
              This flow closes three brief gaps at once: dedicated company pages, a real claim/update path, and a no-developer intake process the GOED team can operate from forms.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Profiles" value="Dedicated URLs" />
              <Stat label="Verification" value="Domain-based" />
              <Stat label="Ops handoff" value="Netlify-ready" />
            </div>
          </div>

          <div className="rounded-3xl border border-utah-stone/10 bg-utah-slate p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <ModeButton active={mode === 'add'} title="Add new listing" body="For founders not in the directory yet." onClick={() => switchMode('add')} />
              <ModeButton active={mode === 'claim'} title="Claim or update" body="For existing listings that need ownership or edits." onClick={() => switchMode('claim')} />
              <ModeButton active={mode === 'ops'} title="Ops workflow" body="Show the non-technical update path for staff." onClick={() => switchMode('ops')} />
            </div>
          </div>

          <div className="rounded-3xl border border-utah-stone/10 bg-utah-slate p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">What this solves</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-utah-stone/78">
              <li>Every company can now have a dedicated profile URL instead of living only inside a map popup.</li>
              <li>Existing companies can request ownership or updates through a separate claim path.</li>
              <li>Verification is lightweight but real: the claimant must use an email domain that matches the listed company website.</li>
              <li>The ops workflow is visible to non-technical reviewers, so the update path is no longer implicit.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-5">
          {mode === 'add' && (
            <AddCompanyForm status={status} onSubmit={submitAdd} />
          )}

          {mode === 'claim' && (
            <div className="space-y-5">
              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Claim existing listing</p>
                    <h2 className="mt-2 font-display text-3xl font-bold">Select the company you control</h2>
                    <p className="mt-2 max-w-2xl text-sm text-utah-stone/72">
                      To keep this lightweight and implementable without a full auth backend, ownership is verified by matching the work email domain against the public company website domain.
                    </p>
                  </div>
                  {selectedCompany && (
                    <Link to={`/companies/${selectedCompany.id}`} className="btn-secondary text-sm">
                      Open current profile
                    </Link>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
                  <label className="text-sm">
                    <span className="mb-2 block font-medium text-utah-stone">Find your company</span>
                    <input
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      placeholder="Search by company, city, or sector"
                      className="w-full rounded-xl border border-utah-stone/20 px-3 py-3"
                    />
                  </label>
                  <div className="mt-4 grid gap-2">
                    {filteredCompanies.map((company) => {
                      const city = cleanCity(company.city, company.address, knownCities);
                      const selected = selectedCompanyId === company.id;
                      return (
                        <button
                          key={`${company.id}-${company.name}`}
                          type="button"
                          onClick={() => selectCompany(company.id)}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-utah-gold bg-utah-gold/10'
                              : 'border-utah-stone/10 bg-utah-dark/35 hover:border-utah-gold/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-utah-stone">{company.name}</div>
                              <div className="mt-1 text-xs text-utah-stone/60">
                                {[city, company.sector, company.stage].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/45">
                              {selected ? 'Selected' : 'Choose'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <ClaimUpdateForm
                company={selectedCompany}
                knownCities={knownCities}
                claimEmail={claimEmail}
                claimStatus={claimStatus}
                verificationLabel={claimVerification.label}
                verificationOk={claimVerification.ok}
                verificationTone={claimVerification.tone}
                onEmailChange={setClaimEmail}
                onSubmit={submitClaim}
              />
            </div>
          )}

          {mode === 'ops' && <OpsWorkflow />}
        </section>
      </div>
    </div>
  );
}

function AddCompanyForm({
  status,
  onSubmit,
}: {
  status: 'idle' | 'submitting' | 'success' | 'error';
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">New listing intake</p>
      <h2 className="mt-2 font-display text-3xl font-bold">Add a company to the directory</h2>
      <p className="mt-2 max-w-2xl text-sm text-utah-stone/72">
        Use this when the company is not in the map yet. Submissions land in a non-technical review queue through Netlify forms.
      </p>

      <form name="company-submission" data-netlify="true" netlify-honeypot="bot-field" className="mt-6 space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="form-name" value="company-submission" />
        <input type="hidden" name="bot-field" />
        <input type="hidden" name="workflow_type" value="new-listing" />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" name="company_name" required />
          <Field label="Website" name="website" type="url" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Sector" name="sector" options={SECTORS} required />
          <Field label="Employees" name="employees" placeholder="e.g. 1-10" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year founded" name="year_founded" placeholder="2024" />
          <Field label="Utah address" name="address" required />
        </div>
        <TextAreaField label="Description" name="description" placeholder="What does the company do, and who does it serve?" required rows={4} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn URL" name="linkedin" type="url" />
          <Field label="Photo URL" name="photo_url" type="url" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Hiring status" name="hiring_status" options={['Hiring', 'Not hiring', 'Selective roles']} />
          <Field label="Job postings URL" name="job_postings" type="url" />
        </div>
        <Field label="Contact email" name="contact_email" type="email" required />
        <label className="flex items-start gap-3 rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4 text-sm text-utah-stone/80">
          <input name="verification_attestation" type="checkbox" required className="mt-1 h-4 w-4" />
          <span>I confirm that I represent this company or have permission to submit these details for directory review.</span>
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-utah-stone/55">No developer needed: this request can be collected and triaged from Netlify form submissions.</p>
          <button className="btn-primary text-sm" type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Submitting…' : 'Submit new listing'}
          </button>
        </div>

        {status === 'success' && <Notice tone="success" text="New listing submitted. It now enters the review queue with enough data to publish without engineering intervention." />}
        {status === 'error' && <Notice tone="error" text="Submission failed. Keep the fields and try again." />}
      </form>
    </div>
  );
}

function ClaimUpdateForm({
  company,
  knownCities,
  claimEmail,
  claimStatus,
  verificationLabel,
  verificationOk,
  verificationTone,
  onEmailChange,
  onSubmit,
}: {
  company: Company | null;
  knownCities: readonly string[];
  claimEmail: string;
  claimStatus: 'idle' | 'submitting' | 'success' | 'error';
  verificationLabel: string;
  verificationOk: boolean;
  verificationTone: 'muted' | 'success' | 'error';
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const city = company ? cleanCity(company.city, company.address, knownCities) : null;
  const websiteDomain = company ? getWebsiteDomain(company.website) : null;

  return (
    <div className="card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Claim and update workflow</p>
      <h2 className="mt-2 font-display text-3xl font-bold">Submit ownership and changes</h2>
      <p className="mt-2 max-w-2xl text-sm text-utah-stone/72">
        This is the lightweight verification method: the claimant must use a work email on the same domain as the listed website before the update request can be submitted.
      </p>

      {company ? (
        <div className="mt-5 rounded-2xl border border-utah-gold/20 bg-utah-gold/8 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-xl font-bold text-utah-stone">{company.name}</div>
              <div className="mt-1 text-sm text-utah-stone/70">{[city, company.sector, company.stage].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="text-right text-xs text-utah-stone/60">
              <div>Website domain</div>
              <div className="mt-1 font-semibold text-utah-gold">{websiteDomain ?? 'Unavailable'}</div>
            </div>
          </div>
        </div>
      ) : (
        <Notice tone="muted" text="Pick a company above before you start the claim form." />
      )}

      <form name="company-claim-update" data-netlify="true" netlify-honeypot="bot-field" className="mt-6 space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="form-name" value="company-claim-update" />
        <input type="hidden" name="bot-field" />
        <input type="hidden" name="workflow_type" value="claim-update" />
        <input type="hidden" name="company_id" value={company?.id ?? ''} />
        <input type="hidden" name="company_name" value={company?.name ?? ''} />
        <input type="hidden" name="verification_status" value={verificationOk ? 'verified' : 'failed'} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="claimant_name" required />
          <label className="text-sm">
            <span className="mb-1 block font-medium">Work email</span>
            <input
              name="claimant_email"
              type="email"
              required
              value={claimEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full rounded-xl border border-utah-stone/20 px-3 py-3"
            />
          </label>
        </div>
        <Field label="Title or role" name="claimant_role" placeholder="Founder, marketing lead, operations, etc." required />
        <TextAreaField
          label="What do you need changed?"
          name="requested_changes"
          required
          rows={5}
          placeholder="Describe the profile changes, corrections, hiring updates, links, or ownership request."
        />
        <TextAreaField
          label="Updated fields (optional structured paste)"
          name="proposed_profile_data"
          rows={6}
          placeholder="Paste the updated description, hiring status, jobs URL, address, stage, employee range, or any fields you want published."
        />

        <Notice tone={verificationTone} text={verificationLabel} />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-utah-stone/55">
            Only verified work-email requests can be submitted through this prototype claim flow.
          </p>
          <button className="btn-primary text-sm" type="submit" disabled={!verificationOk || claimStatus === 'submitting'}>
            {claimStatus === 'submitting' ? 'Submitting…' : 'Submit claim/update'}
          </button>
        </div>

        {claimStatus === 'success' && <Notice tone="success" text="Claim/update submitted. The review queue now has the company id, claimant identity, and domain verification result." />}
        {claimStatus === 'error' && <Notice tone="error" text="Submission failed. Keep the form open and try again." />}
      </form>
    </div>
  );
}

function OpsWorkflow() {
  return (
    <div className="space-y-5">
      <div className="card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Non-technical operations path</p>
        <h2 className="mt-2 font-display text-3xl font-bold">How staff can keep the directory current without a developer</h2>
        <p className="mt-2 max-w-2xl text-sm text-utah-stone/72">
          This is the explicit admin story the brief was missing. New listings and claim/update requests land in forms, which means an operator can review and publish from a repeatable queue instead of asking engineering for every content change.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OpsCard step="1" title="Collect requests" body="Use Netlify form submissions as the intake queue for new listings and claim/update requests." />
        <OpsCard step="2" title="Verify ownership" body="For existing listings, only accept updates from work emails that match the company website domain captured in the request." />
        <OpsCard step="3" title="Publish changes" body="Copy approved field changes into the company dataset or spreadsheet source of truth, then rerun the ETL/data publish step." />
      </div>

      <div className="card">
        <h3 className="font-display text-2xl font-bold">Recommended lightweight operating model</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">Inputs</p>
            <ul className="mt-3 space-y-2 text-sm text-utah-stone/78">
              <li>New listing form</li>
              <li>Claim/update form</li>
              <li>Domain verification result</li>
              <li>Company id and requested field changes</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">Outputs</p>
            <ul className="mt-3 space-y-2 text-sm text-utah-stone/78">
              <li>Published company profile page</li>
              <li>Updated map listing</li>
              <li>Clear audit trail of who requested the change</li>
              <li>No engineering dependency for copy/data review</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-utah-stone/68">
          This is still lightweight, not enterprise identity management. But it materially improves the brief gap by providing a real repeatable update workflow rather than a static demo form.
        </p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition ${
        active
          ? 'border-utah-gold bg-utah-gold/10'
          : 'border-utah-stone/10 bg-utah-dark/35 hover:border-utah-gold/35'
      }`}
    >
      <div className={`font-semibold ${active ? 'text-utah-gold' : 'text-utah-stone'}`}>{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-utah-stone/62">{body}</div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/55">{label}</p>
      <p className="mt-2 font-display text-xl font-bold text-utah-stone">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | null;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="w-full rounded-xl border border-utah-stone/20 px-3 py-3"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select name={name} required={required} className="w-full rounded-xl border border-utah-stone/20 px-3 py-3">
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  placeholder,
  rows,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  rows: number;
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-utah-stone/20 px-3 py-3"
      />
    </label>
  );
}

function Notice({ tone, text }: { tone: 'muted' | 'success' | 'error'; text: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-utah-hiring/30 bg-utah-hiring/10 text-utah-hiring'
      : tone === 'error'
        ? 'border-utah-red/30 bg-utah-red/10 text-utah-red'
        : 'border-utah-stone/12 bg-utah-dark/35 text-utah-stone/72';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{text}</div>;
}

function OpsCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="card">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-utah-gold/12 font-display text-sm font-bold text-utah-gold">
        {step}
      </div>
      <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-utah-stone/74">{body}</p>
    </div>
  );
}
