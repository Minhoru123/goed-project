import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  approveClaimRequest,
  approveUpdateRequest,
  denyClaimRequest,
  listPendingClaimRequests,
  listPendingUpdateRequests,
  rejectUpdateRequest,
  type PendingClaimRequest,
  type PendingUpdateRequest,
} from '../lib/companyDirectoryBackend';

type LoadState = 'loading' | 'ready' | 'error';

export default function Admin() {
  const { enabled, loading: authLoading, user, isStaff } = useAuth();
  const [claims, setClaims] = useState<PendingClaimRequest[]>([]);
  const [updates, setUpdates] = useState<PendingUpdateRequest[]>([]);
  const [load, setLoad] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoad('loading');
    setError(null);
    try {
      const [claimRows, updateRows] = await Promise.all([
        listPendingClaimRequests(),
        listPendingUpdateRequests(),
      ]);
      setClaims(claimRows);
      setUpdates(updateRows);
      setLoad('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue.');
      setLoad('error');
    }
  }, []);

  useEffect(() => {
    if (isStaff) {
      refresh();
    }
  }, [isStaff, refresh]);

  if (!enabled) {
    return (
      <PageShell>
        <Notice tone="error" text="Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using the admin queue." />
      </PageShell>
    );
  }

  if (authLoading) {
    return (
      <PageShell>
        <Notice tone="muted" text="Checking your sign-in session…" />
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <Notice tone="muted" text="Sign in with your staff email on the directory page first." />
        <Link to="/add-company" className="btn-primary mt-4 text-sm">Go to sign in</Link>
      </PageShell>
    );
  }

  if (!isStaff) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-utah-gold">Staff queue</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-utah-stone">Approval queue</h1>
          <p className="mt-2 max-w-2xl text-sm text-utah-stone/85">
            Review pending company claims and update requests. Approving a claim grants the requester ownership; approving an update marks it ready to publish.
          </p>
        </div>
        <button className="btn-secondary text-sm" onClick={refresh} type="button" disabled={load === 'loading'}>
          {load === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <Notice tone="error" text={error} />}

      <section className="mt-2">
        <SectionHeader title="Pending claims" count={claims.length} />
        {load === 'loading' && claims.length === 0 && <Notice tone="muted" text="Loading claims…" />}
        {load === 'ready' && claims.length === 0 && <Notice tone="muted" text="No pending claims." />}
        <div className="mt-3 space-y-3">
          {claims.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              busy={busyId === claim.id}
              onAction={async (status) => {
                setBusyId(claim.id);
                try {
                  if (status === 'approved') {
                    await approveClaimRequest(claim.id);
                  } else {
                    await denyClaimRequest(claim.id);
                  }
                  setClaims((prev) => prev.filter((entry) => entry.id !== claim.id));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to update claim.');
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Pending update requests" count={updates.length} />
        {load === 'loading' && updates.length === 0 && <Notice tone="muted" text="Loading updates…" />}
        {load === 'ready' && updates.length === 0 && <Notice tone="muted" text="No pending update requests." />}
        <div className="mt-3 space-y-3">
          {updates.map((update) => (
            <UpdateRow
              key={update.id}
              update={update}
              busy={busyId === update.id}
              onAction={async (status) => {
                setBusyId(update.id);
                try {
                  if (status === 'approved') {
                    await approveUpdateRequest(update.id);
                  } else {
                    await rejectUpdateRequest(update.id);
                  }
                  setUpdates((prev) => prev.filter((entry) => entry.id !== update.id));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to update request.');
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-utah-stone/10 pb-2">
      <h2 className="font-display text-2xl font-bold text-utah-stone">{title}</h2>
      <span className="rounded-full border border-utah-stone/15 bg-utah-dark/40 px-3 py-1 text-xs font-semibold text-utah-stone/85">
        {count} pending
      </span>
    </div>
  );
}

function ClaimRow({
  claim,
  busy,
  onAction,
}: {
  claim: PendingClaimRequest;
  busy: boolean;
  onAction: (status: 'approved' | 'denied') => Promise<void>;
}) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold text-utah-stone">{claim.companyName}</div>
          <div className="mt-1 text-xs text-utah-stone/85">
            <Link to={`/companies/${encodeURIComponent(claim.companyId)}`} className="text-utah-gold hover:underline">
              View profile →
            </Link>
          </div>
        </div>
        <VerificationBadge status={claim.verificationStatus} domain={claim.websiteDomain} />
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <Field label="Claimant" value={`${claim.claimantName} · ${claim.claimantRole}`} />
        <Field label="Email" value={claim.claimantEmail} mono />
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/85">Requested changes</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-utah-stone/90">{claim.requestedChanges}</p>
      </div>
      {claim.proposedProfileData && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-utah-gold">Proposed profile data</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-utah-stone/15 bg-utah-dark/40 p-3 text-xs text-utah-stone/90">
            {claim.proposedProfileData}
          </pre>
        </details>
      )}
      <ActionButtons busy={busy} onApprove={() => onAction('approved')} onReject={() => onAction('denied')} rejectLabel="Deny" />
    </div>
  );
}

function UpdateRow({
  update,
  busy,
  onAction,
}: {
  update: PendingUpdateRequest;
  busy: boolean;
  onAction: (status: 'approved' | 'rejected') => Promise<void>;
}) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold text-utah-stone">{update.companyName}</div>
          <div className="mt-1 text-xs text-utah-stone/85">
            <Link to={`/companies/${encodeURIComponent(update.companyId)}`} className="text-utah-gold hover:underline">
              View profile →
            </Link>
          </div>
        </div>
        <span className="rounded-full border border-utah-stone/20 bg-utah-dark/40 px-3 py-1 text-[11px] font-semibold text-utah-stone/85">
          Update request
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <Field label="Requester" value={`${update.requesterName} · ${update.requesterRole}`} />
        <Field label="Email" value={update.requesterEmail} mono />
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/85">Requested changes</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-utah-stone/90">{update.requestedChanges}</p>
      </div>
      {update.proposedProfileData && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-utah-gold">Proposed profile data</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md border border-utah-stone/15 bg-utah-dark/40 p-3 text-xs text-utah-stone/90">
            {update.proposedProfileData}
          </pre>
        </details>
      )}
      <ActionButtons busy={busy} onApprove={() => onAction('approved')} onReject={() => onAction('rejected')} />
    </div>
  );
}

function ActionButtons({
  busy,
  onApprove,
  onReject,
  rejectLabel = 'Reject',
}: {
  busy: boolean;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  rejectLabel?: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="btn-primary text-sm" onClick={() => void onApprove()} disabled={busy}>
        {busy ? 'Working…' : 'Approve'}
      </button>
      <button type="button" className="btn-secondary text-sm" onClick={() => void onReject()} disabled={busy}>
        {rejectLabel}
      </button>
    </div>
  );
}

function VerificationBadge({ status, domain }: { status: 'verified' | 'failed'; domain: string | null }) {
  const isVerified = status === 'verified';
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
        isVerified
          ? 'border-utah-hiring/40 bg-utah-hiring/10 text-utah-hiring'
          : 'border-utah-gold/40 bg-utah-gold/10 text-utah-gold'
      }`}
      title={domain ?? undefined}
    >
      {isVerified ? `Domain verified · ${domain ?? 'n/a'}` : 'Manual review needed'}
    </span>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-utah-stone/10 bg-utah-dark/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-utah-stone/85">{label}</p>
      <p className={`mt-1 text-sm text-utah-stone ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function Notice({ tone, text }: { tone: 'muted' | 'success' | 'error'; text: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-utah-hiring/30 bg-utah-hiring/10 text-utah-hiring'
      : tone === 'error'
        ? 'border-utah-red/30 bg-utah-red/10 text-utah-red'
        : 'border-utah-stone/15 bg-utah-dark/40 text-utah-stone/85';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{text}</div>;
}
