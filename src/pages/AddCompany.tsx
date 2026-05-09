import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  claimCompanyOwnership,
  createCompanyWithOwner,
  getActiveMembership,
  type CompanyMembership,
  type CompanyProfileInput,
  updateOwnedCompany,
} from '../lib/companyDirectoryBackend';
import { cleanCity, getEmailDomain, getKnownCities, getWebsiteDomain } from '../lib/companyMeta';
import { loadCompanies } from '../lib/loadData';
import type { Company } from '../types';

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

const STAGES = ['Idea', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Bootstrapped', 'Other'];

type Mode = 'add' | 'claim' | 'ops';
type Tone = 'muted' | 'success' | 'error';
type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

function inferMode(value: string | null): Mode {
  if (value === 'claim' || value === 'ops') return value;
  return 'add';
}

function getDomainVerification(website: string | null, email: string) {
  const emailDomain = getEmailDomain(email);
  const websiteDomain = getWebsiteDomain(website);

  if (!website?.trim()) {
    return { ok: false, label: 'Enter the company website to verify ownership.', tone: 'muted' as const };
  }
  if (!email.trim()) {
    return { ok: false, label: 'Sign in with a work email first.', tone: 'muted' as const };
  }
  if (!emailDomain) {
    return { ok: false, label: 'Enter a valid work email address.', tone: 'error' as const };
  }
  if (!websiteDomain) {
    return { ok: false, label: 'This website does not expose a usable domain.', tone: 'error' as const };
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

function getClaimVerification(company: Company | null, email: string) {
  if (!company) {
    return { ok: false, label: 'Select a company to verify ownership.', tone: 'muted' as const };
  }
  return getDomainVerification(company.website, email);
}

function parseFoundedYear(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHiring(value: FormDataEntryValue | null): boolean | null {
  if (typeof value !== 'string' || !value) return null;
  if (value === 'hiring') return true;
  if (value === 'not-hiring') return false;
  return null;
}

function hiringSelectValue(value: boolean | null): string {
  if (value === true) return 'hiring';
  if (value === false) return 'not-hiring';
  return 'unknown';
}

function parsePhotoUrls(data: FormData): string[] {
  const raw = data.get('photo_urls');
  if (typeof raw !== 'string') return [];
  return raw
    .split(/\r?\n|,/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function buildProfileInput(data: FormData, fallbackContactEmail: string | null = null): CompanyProfileInput {
  const photoUrls = parsePhotoUrls(data);
  return {
    name: requiredString(data, 'company_name'),
    website: optionalString(data, 'website'),
    linkedin: optionalString(data, 'linkedin'),
    address: requiredString(data, 'address'),
    city: optionalString(data, 'city'),
    description: optionalString(data, 'description'),
    stage: optionalString(data, 'stage'),
    employees: optionalString(data, 'employees'),
    sector: optionalString(data, 'sector'),
    foundedYear: parseFoundedYear(data.get('year_founded')),
    hiring: parseHiring(data.get('hiring_status')),
    jobsUrl: optionalString(data, 'job_postings'),
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
    contactEmail: optionalString(data, 'contact_email') ?? fallbackContactEmail,
  };
}

export default function AddCompany() {
  const { enabled, loading: authLoading, user, signInWithMagicLink, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [addStatus, setAddStatus] = useState<SubmissionStatus>('idle');
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<SubmissionStatus>('idle');
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<SubmissionStatus>('idle');
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState(searchParams.get('company') ?? '');
  const [companySearch, setCompanySearch] = useState('');
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [newCompanyWebsite, setNewCompanyWebsite] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [membership, setMembership] = useState<CompanyMembership | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const mode = inferMode(searchParams.get('mode'));

  async function refreshCompanies() {
    setLoadingCompanies(true);
    try {
      setCompanies(await loadCompanies());
    } finally {
      setLoadingCompanies(false);
    }
  }

  useEffect(() => {
    refreshCompanies().catch(() => setCompanies([]));
  }, []);

  const knownCities = useMemo(() => getKnownCities(companies), [companies]);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );
  const authenticatedEmail = user?.email ?? '';
  const claimVerification = useMemo(
    () => getClaimVerification(selectedCompany, authenticatedEmail),
    [selectedCompany, authenticatedEmail]
  );
  const addVerification = useMemo(
    () => getDomainVerification(newCompanyWebsite, authenticatedEmail),
    [newCompanyWebsite, authenticatedEmail]
  );
  const canUseBackend = enabled && !authLoading;
  const canSubmitAuthenticated = canUseBackend && !!user?.id;
  const hasActiveMembership = membership?.status === 'active';

  useEffect(() => {
    if (!enabled || !user?.id || !selectedCompanyId) {
      setMembership(null);
      setMembershipLoading(false);
      return;
    }

    let cancelled = false;
    setMembershipLoading(true);
    getActiveMembership(selectedCompanyId, user.id)
      .then((result) => {
        if (!cancelled) {
          setMembership(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMembership(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMembershipLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, selectedCompanyId, user?.id]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies.slice(0, 12);
    return companies
      .filter((company) => {
        const city = cleanCity(company.city, company.address, knownCities) ?? '';
        return `${company.name} ${city} ${company.sector ?? ''}`.toLowerCase().includes(query);
      })
      .slice(0, 12);
  }, [companies, companySearch, knownCities]);

  function switchMode(next: Mode) {
    const params = new URLSearchParams(searchParams);
    params.set('mode', next);
    if (next !== 'claim') params.delete('company');
    setSearchParams(params);
    setAddStatus('idle');
    setClaimStatus('idle');
    setEditStatus('idle');
    setAddMessage(null);
    setClaimMessage(null);
    setEditMessage(null);
  }

  function selectCompany(id: string) {
    setSelectedCompanyId(id);
    const params = new URLSearchParams(searchParams);
    params.set('mode', 'claim');
    params.set('company', id);
    setSearchParams(params);
    setClaimStatus('idle');
    setClaimMessage(null);
    setEditStatus('idle');
    setEditMessage(null);
  }

  async function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.id || !authenticatedEmail) {
      setAddStatus('error');
      setAddMessage('Sign in with a work email before publishing a company.');
      return;
    }
    if (!addVerification.ok) {
      setAddStatus('error');
      setAddMessage(addVerification.label);
      return;
    }

    setAddStatus('submitting');
    setAddMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const created = await createCompanyWithOwner(user.id, buildProfileInput(data, authenticatedEmail));
      setCompanies((current) => [created, ...current].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCompanyId(created.id);
      setMembership({ companyId: created.id, role: 'owner', status: 'active' });
      form.reset();
      setNewCompanyWebsite('');
      setAddStatus('success');
      setAddMessage('Company published live. You can keep editing it immediately.');
    } catch (error) {
      setAddStatus('error');
      setAddMessage(error instanceof Error ? error.message : 'Company creation failed.');
    }
  }

  async function handleClaimCompany() {
    if (!claimVerification.ok || !user?.id || !selectedCompany) {
      setClaimStatus('error');
      setClaimMessage(claimVerification.label);
      return;
    }

    setClaimStatus('submitting');
    setClaimMessage(null);
    try {
      const nextMembership = await claimCompanyOwnership(selectedCompany.id, user.id);
      setMembership(nextMembership);
      setClaimStatus('success');
      setClaimMessage('Company access verified. The live profile editor is unlocked below.');
    } catch (error) {
      setClaimStatus('error');
      setClaimMessage(error instanceof Error ? error.message : 'Company claim failed.');
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompany || !hasActiveMembership) return;

    setEditStatus('submitting');
    setEditMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const updated = await updateOwnedCompany(selectedCompany.id, buildProfileInput(data, authenticatedEmail || null));
      setCompanies((current) => current.map((company) => (company.id === updated.id ? updated : company)));
      setEditStatus('success');
      setEditMessage('Live profile updated.');
    } catch (error) {
      setEditStatus('error');
      setEditMessage(error instanceof Error ? error.message : 'Profile update failed.');
    }
  }

  async function sendMagicLink() {
    const email = magicLinkEmail.trim().toLowerCase();
    if (!email) {
      setAuthMessage('Enter a work email first.');
      return;
    }
    setAuthBusy(true);
    const error = await signInWithMagicLink(email);
    setAuthBusy(false);
    if (error) {
      setAuthMessage(error);
      return;
    }
    setAuthMessage(`Magic link sent to ${email}. Open it from your inbox to continue.`);
  }

  async function handleSignOut() {
    setAuthBusy(true);
    const error = await signOut();
    setAuthBusy(false);
    if (error) {
      setAuthMessage(error);
      return;
    }
    setMembership(null);
    setAuthMessage('Signed out.');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-utah-gold">Company updates</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-utah-stone">Add, claim, or update a company.</h1>
        <p className="mt-3 max-w-2xl text-base text-utah-stone/85">
          Verified company owners can publish and edit their profile directly. No redeploy required.
        </p>
      </section>

      <section className="mb-6 rounded-3xl border border-utah-stone/10 bg-utah-slate p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <ModeButton active={mode === 'add'} title="Add new listing" body="Publish a new company profile live." onClick={() => switchMode('add')} />
          <ModeButton active={mode === 'claim'} title="Claim or update" body="Verify ownership, then edit live." onClick={() => switchMode('claim')} />
          <ModeButton active={mode === 'ops'} title="Ops workflow" body="How staff keep edge cases moving." onClick={() => switchMode('ops')} />
        </div>
      </section>

      <section className="space-y-5">
        {mode !== 'ops' && (
          <AuthCard
            enabled={enabled}
            loading={authLoading}
            userEmail={authenticatedEmail || null}
            magicLinkEmail={magicLinkEmail}
            authBusy={authBusy}
            message={authMessage}
            onMagicLinkEmailChange={setMagicLinkEmail}
            onSendMagicLink={sendMagicLink}
            onSignOut={handleSignOut}
          />
        )}

        {mode === 'add' && (
          <AddCompanyForm
            status={addStatus}
            message={addMessage}
            authReady={canSubmitAuthenticated}
            authEnabled={enabled}
            authenticatedEmail={authenticatedEmail || null}
            verificationLabel={addVerification.label}
            verificationTone={addVerification.tone}
            onWebsiteChange={setNewCompanyWebsite}
            onSubmit={submitAdd}
          />
        )}

        {mode === 'claim' && (
          <div className="space-y-5">
            <ClaimStepper
              currentStep={
                claimStatus === 'success' || hasActiveMembership
                  ? 3
                  : selectedCompany && claimVerification.ok
                    ? 2
                    : 1
              }
            />
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Claim existing listing</p>
                  <h2 className="mt-2 font-display text-3xl font-bold">Select your company</h2>
                </div>
                {selectedCompany && (
                  <Link to={`/companies/${selectedCompany.id}`} className="btn-secondary text-sm">
                    Open profile
                  </Link>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
                <label className="text-sm">
                  <span className="mb-2 block font-medium text-utah-stone">Find your company</span>
                  <input
                    value={companySearch}
                    onChange={(event) => setCompanySearch(event.target.value)}
                    placeholder="Search by company, city, or sector"
                    className="w-full rounded-xl border border-utah-stone/20 px-3 py-3"
                  />
                </label>
                <div className="mt-4 grid gap-2">
                  {loadingCompanies && <Notice tone="muted" text="Loading company directory…" />}
                  {!loadingCompanies &&
                    filteredCompanies.map((company) => {
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
                              <div className="mt-1 text-xs text-utah-stone/80">
                                {[city, company.sector, company.stage].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/80">
                              {selected ? 'Selected' : 'Choose'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            <ClaimCompanyCard
              company={selectedCompany}
              knownCities={knownCities}
              authReady={canSubmitAuthenticated}
              authEmail={authenticatedEmail || null}
              hasActiveMembership={hasActiveMembership}
              membershipLoading={membershipLoading}
              membershipRole={membership?.role ?? null}
              claimStatus={claimStatus}
              claimMessage={claimMessage}
              verificationLabel={claimVerification.label}
              verificationOk={claimVerification.ok}
              verificationTone={claimVerification.tone}
              onClaim={handleClaimCompany}
            />

            {selectedCompany && hasActiveMembership && (
              <OwnedCompanyEditor
                company={selectedCompany}
                status={editStatus}
                message={editMessage}
                onSubmit={submitEdit}
              />
            )}
          </div>
        )}

        {mode === 'ops' && <OpsWorkflow />}
      </section>
    </div>
  );
}

function AddCompanyForm({
  status,
  message,
  authReady,
  authEnabled,
  authenticatedEmail,
  verificationLabel,
  verificationTone,
  onWebsiteChange,
  onSubmit,
}: {
  status: SubmissionStatus;
  message: string | null;
  authReady: boolean;
  authEnabled: boolean;
  authenticatedEmail: string | null;
  verificationLabel: string;
  verificationTone: Tone;
  onWebsiteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">New listing intake</p>
      <h2 className="mt-2 font-display text-3xl font-bold">Add a company to the directory</h2>
      <p className="mt-2 max-w-2xl text-sm text-utah-stone/85">Use this when the company is not in the directory yet.</p>
      {!authEnabled && (
        <Notice tone="error" text="Supabase is not configured yet. Add the frontend Supabase environment keys before using this flow." />
      )}
      {authEnabled && !authReady && (
        <Notice tone="muted" text="Sign in with your work email first. New listings publish under the authenticated company owner." />
      )}
      {authReady && authenticatedEmail && (
        <>
          <Notice tone="success" text={`Signed in as ${authenticatedEmail}.`} />
          <div className="mt-3">
            <Notice tone={verificationTone} text={verificationLabel} />
          </div>
        </>
      )}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" name="company_name" required />
          <Field label="Website" name="website" type="url" required onValueChange={onWebsiteChange} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Sector" name="sector" options={SECTORS} required />
          <SelectField label="Stage" name="stage" options={STAGES} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employees" name="employees" placeholder="e.g. 1-10" />
          <Field label="Year founded" name="year_founded" placeholder="2024" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Utah address" name="address" required />
          <Field label="City (optional)" name="city" placeholder="Salt Lake City" />
        </div>
        <TextAreaField label="Description" name="description" placeholder="What does the company do, and who does it serve?" required rows={4} />
        <Field label="LinkedIn URL" name="linkedin" type="url" />
        <TextAreaField
          label="Photo URLs (one per line)"
          name="photo_urls"
          rows={3}
          placeholder={'https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg'}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Hiring status"
            name="hiring_status"
            options={[
              { value: 'unknown', label: 'Unknown' },
              { value: 'hiring', label: 'Hiring now' },
              { value: 'not-hiring', label: 'Not hiring' },
            ]}
          />
          <Field label="Job postings URL" name="job_postings" type="url" />
        </div>
        <Field label="Contact email" name="contact_email" type="email" />
        <label className="flex items-start gap-3 rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4 text-sm text-utah-stone/80">
          <input name="verification_attestation" type="checkbox" required className="mt-1 h-4 w-4" />
          <span>I confirm that I represent this company and can publish these details.</span>
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-utah-stone/85">Publishes directly to the live company directory.</p>
          <button className="btn-primary text-sm" type="submit" disabled={status === 'submitting' || !authReady}>
            {status === 'submitting' ? 'Publishing…' : 'Publish company'}
          </button>
        </div>

        {message && <Notice tone={status === 'success' ? 'success' : status === 'error' ? 'error' : 'muted'} text={message} />}
      </form>
    </div>
  );
}

function ClaimCompanyCard({
  company,
  knownCities,
  authReady,
  authEmail,
  hasActiveMembership,
  membershipLoading,
  membershipRole,
  claimStatus,
  claimMessage,
  verificationLabel,
  verificationOk,
  verificationTone,
  onClaim,
}: {
  company: Company | null;
  knownCities: readonly string[];
  authReady: boolean;
  authEmail: string | null;
  hasActiveMembership: boolean;
  membershipLoading: boolean;
  membershipRole: string | null;
  claimStatus: SubmissionStatus;
  claimMessage: string | null;
  verificationLabel: string;
  verificationOk: boolean;
  verificationTone: Tone;
  onClaim: () => Promise<void>;
}) {
  const city = company ? cleanCity(company.city, company.address, knownCities) : null;
  const websiteDomain = company ? getWebsiteDomain(company.website) : null;

  return (
    <div className="card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Claim and update workflow</p>
      <h2 className="mt-2 font-display text-3xl font-bold">
        {hasActiveMembership ? 'Live company editor unlocked' : 'Verify ownership'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-utah-stone/85">
        {hasActiveMembership
          ? 'You already have active company access. Save changes below and the profile updates immediately.'
          : 'Sign in with a work email that matches the company website domain, then claim access in one click.'}
      </p>

      {company ? (
        <div className="mt-5 rounded-2xl border border-utah-gold/20 bg-utah-gold/8 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-display text-xl font-bold text-utah-stone">{company.name}</div>
              <div className="mt-1 text-sm text-utah-stone/85">{[city, company.sector, company.stage].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="text-right text-xs text-utah-stone/80">
              <div>Website domain</div>
              <div className="mt-1 font-semibold text-utah-gold">{websiteDomain ?? 'Unavailable'}</div>
            </div>
          </div>
        </div>
      ) : (
        <Notice tone="muted" text="Pick a company above before you start." />
      )}

      {membershipLoading && <Notice tone="muted" text="Checking your company access…" />}
      {!authReady && <Notice tone="muted" text="Sign in first to claim company access." />}
      {authReady && authEmail && (
        <div className="mt-4">
          <Notice
            tone={hasActiveMembership ? 'success' : verificationTone}
            text={
              hasActiveMembership
                ? `Authenticated as ${authEmail}. Active ${membershipRole ?? 'company'} access confirmed.`
                : `Authenticated as ${authEmail}. ${verificationLabel}`
            }
          />
        </div>
      )}

      {!hasActiveMembership && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-utah-stone/85">Basic verification uses an email-domain match against the public website on the profile.</p>
          <button className="btn-primary text-sm" type="button" onClick={() => void onClaim()} disabled={!authReady || !verificationOk || claimStatus === 'submitting'}>
            {claimStatus === 'submitting' ? 'Verifying…' : 'Verify and claim access'}
          </button>
        </div>
      )}

      {claimMessage && (
        <div className="mt-4">
          <Notice tone={claimStatus === 'success' ? 'success' : claimStatus === 'error' ? 'error' : 'muted'} text={claimMessage} />
        </div>
      )}
    </div>
  );
}

function OwnedCompanyEditor({
  company,
  status,
  message,
  onSubmit,
}: {
  company: Company;
  status: SubmissionStatus;
  message: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Live profile editor</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Edit {company.name}</h2>
        </div>
        <Link to={`/companies/${company.id}`} className="btn-secondary text-sm">
          View public profile
        </Link>
      </div>

      <form key={company.id} className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" name="company_name" required defaultValue={company.name} />
          <Field label="Website" name="website" type="url" defaultValue={company.website} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Sector" name="sector" options={SECTORS} defaultValue={company.sector} />
          <SelectField label="Stage" name="stage" options={STAGES} defaultValue={company.stage} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employees" name="employees" defaultValue={company.employees} />
          <Field label="Year founded" name="year_founded" defaultValue={company.foundedYear} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Utah address" name="address" required defaultValue={company.address} />
          <Field label="City (optional)" name="city" defaultValue={company.city} />
        </div>
        <TextAreaField label="Description" name="description" rows={5} defaultValue={company.description} />
        <Field label="LinkedIn URL" name="linkedin" type="url" defaultValue={company.linkedin} />
        <TextAreaField
          label="Photo URLs (one per line)"
          name="photo_urls"
          rows={3}
          placeholder={'https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg'}
          defaultValue={company.photoUrls.join('\n')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Hiring status"
            name="hiring_status"
            defaultValue={hiringSelectValue(company.hiring)}
            options={[
              { value: 'unknown', label: 'Unknown' },
              { value: 'hiring', label: 'Hiring now' },
              { value: 'not-hiring', label: 'Not hiring' },
            ]}
          />
          <Field label="Job postings URL" name="job_postings" type="url" defaultValue={company.jobsUrl} />
        </div>
        <Field label="Contact email" name="contact_email" type="email" />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-utah-stone/85">Saves directly to the live company profile.</p>
          <button className="btn-primary text-sm" type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Saving…' : 'Save live profile'}
          </button>
        </div>

        {message && <Notice tone={status === 'success' ? 'success' : status === 'error' ? 'error' : 'muted'} text={message} />}
      </form>
    </div>
  );
}

function AuthCard({
  enabled,
  loading,
  userEmail,
  magicLinkEmail,
  authBusy,
  message,
  onMagicLinkEmailChange,
  onSendMagicLink,
  onSignOut,
}: {
  enabled: boolean;
  loading: boolean;
  userEmail: string | null;
  magicLinkEmail: string;
  authBusy: boolean;
  message: string | null;
  onMagicLinkEmailChange: (value: string) => void;
  onSendMagicLink: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <div className="card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Company authentication</p>
      <h2 className="mt-2 font-display text-2xl font-bold">Use a magic link tied to the company email.</h2>
      {!enabled && (
        <Notice tone="error" text="Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using this flow." />
      )}
      {enabled && loading && <Notice tone="muted" text="Checking your sign-in session…" />}
      {enabled && !loading && userEmail && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-utah-hiring/30 bg-utah-hiring/10 p-4">
          <div>
            <p className="text-sm font-medium text-utah-hiring">Signed in</p>
            <p className="text-sm text-utah-stone">{userEmail}</p>
          </div>
          <button className="btn-secondary text-sm" type="button" onClick={() => void onSignOut()} disabled={authBusy}>
            Sign out
          </button>
        </div>
      )}
      {enabled && !loading && !userEmail && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <Field
            label="Work email"
            name="magic_link_email"
            type="email"
            placeholder="you@company.com"
            value={magicLinkEmail}
            onValueChange={onMagicLinkEmailChange}
          />
          <div className="flex items-end">
            <button className="btn-primary text-sm" type="button" onClick={() => void onSendMagicLink()} disabled={authBusy}>
              {authBusy ? 'Sending…' : 'Send magic link'}
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="mt-4">
          <Notice tone="muted" text={message} />
        </div>
      )}
    </div>
  );
}

function OpsWorkflow() {
  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-gold">Non-technical operations path</p>
        <h2 className="mt-2 font-display text-3xl font-bold">How staff keep the directory current</h2>
        <p className="mt-2 max-w-2xl text-sm text-utah-stone/85">Keep the process simple: curate resources, help edge cases, let verified owners self-serve.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OpsCard step="1" title="Programs stay editable" body="Resources can come from the live Google Sheet feed, so non-technical staff can update them without a redeploy." />
        <OpsCard step="2" title="Companies self-serve" body="Verified owners claim access with a matching work-email domain, then edit their profile live in the app." />
        <OpsCard step="3" title="Staff handle exceptions" body="Unclaimed listings, bad website domains, and data cleanup cases stay in the manual support lane." />
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
      <div className="mt-1 text-xs leading-relaxed text-utah-stone/80">{body}</div>
    </button>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
  value,
  onValueChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | null;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={value === undefined ? defaultValue ?? undefined : undefined}
        value={value}
        onChange={onValueChange ? (event) => onValueChange(event.target.value) : undefined}
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
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[] | { value: string; label: string }[];
  required?: boolean;
  defaultValue?: string | null;
}) {
  const normalized = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select name={name} required={required} defaultValue={defaultValue ?? ''} className="w-full rounded-xl border border-utah-stone/20 px-3 py-3">
        <option value="">Select an option</option>
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
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
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  rows: number;
  required?: boolean;
  defaultValue?: string | null;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="w-full rounded-xl border border-utah-stone/20 px-3 py-3"
      />
    </label>
  );
}

function Notice({ tone, text }: { tone: Tone; text: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-utah-hiring/30 bg-utah-hiring/10 text-utah-hiring'
      : tone === 'error'
        ? 'border-utah-red/30 bg-utah-red/10 text-utah-red'
        : 'border-utah-stone/12 bg-utah-dark/35 text-utah-stone/85';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{text}</div>;
}

function OpsCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="card">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-utah-gold/12 font-display text-sm font-bold text-utah-gold">
        {step}
      </div>
      <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-utah-stone/85">{body}</p>
    </div>
  );
}

function ClaimStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Verify Identity' },
    { n: 2, label: 'Update Details' },
    { n: 3, label: 'Confirmation' },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-3 py-2 sm:gap-6">
      {steps.map((s, i) => {
        const done = currentStep > s.n;
        const active = currentStep === s.n;
        return (
          <div key={s.n} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-utah-gold text-utah-dark'
                    : active
                      ? 'bg-utah-gold text-utah-dark'
                      : 'border border-utah-stone/25 bg-utah-slate text-utah-stone/65'
                }`}
              >
                {done ? '✓' : s.n}
              </span>
              <span
                className={`text-sm font-semibold ${
                  active ? 'text-utah-gold' : done ? 'text-utah-stone/85' : 'text-utah-stone/55'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <span className="hidden h-px w-10 bg-utah-stone/20 sm:block" />}
          </div>
        );
      })}
    </div>
  );
}

function requiredString(data: FormData, key: string): string {
  const value = data.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value.trim();
}

function optionalString(data: FormData, key: string): string | null {
  const value = data.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
