import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-utah-gold/20 bg-gradient-to-br from-utah-navy via-utah-dark to-utah-slate p-8 shadow-2xl shadow-black/25 md:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-utah-gold">
            Utah founder infrastructure
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-bold leading-[0.96] text-utah-stone md:text-7xl">
            A better front door to Utah&apos;s startup ecosystem.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-utah-stone/75">
            Replace broken discovery with a founder navigator, a credible statewide startup map, and a lighter-weight
            operating model for keeping ecosystem data current.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/navigator?role=founder" className="btn-primary text-sm">
              Start founder navigator
            </Link>
            <Link to="/map?role=investor" className="btn-secondary text-sm">
              Open startup map
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Metric label="Resources" value="213" body="Programs, funds, support services, and public pathways." />
          <Metric label="Companies" value="220" body="Searchable Utah startups with profiles, map presence, and update path." />
          <Metric label="Journey steps" value="19" body="Matches align to the existing Utah entrepreneur journey model." />
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-utah-stone/10 bg-utah-slate p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-utah-stone/45">Why this exists</p>
          <h2 className="mt-3 font-display text-3xl font-bold">Discovery is the product.</h2>
          <p className="mt-4 text-base leading-relaxed text-utah-stone/75">
            Founders need the right state program quickly. Investors need a credible picture of what is actually being built. Operators need a way to keep data current without waiting on engineering.
          </p>
          <div className="mt-6 space-y-3">
            <Signal title="Founder path" body="Guided matching to the right programs with a printable briefing." />
            <Signal title="Map and profiles" body="A visible, explorable statewide startup directory with shareable profile URLs." />
            <Signal title="Update workflow" body="A claim/update flow with lightweight domain verification and a no-dev review path." />
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-utah-stone/45">
            Pick your starting point
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <EntryCard
              to="/navigator?role=founder"
              tag="For founders"
              title="Get matched to the right Utah support"
              body="Use the guided flow or freeform intake, align to the 19-step journey, and leave with a practical next-move briefing."
              cta="Start founder navigator"
            />
            <EntryCard
              to="/map?role=investor"
              tag="For investors"
              title="Read the ecosystem through the map"
              body="Browse companies by city, stage, hiring status, and sector. Open dedicated profiles, not just tiny popups."
              cta="Explore startup map"
            />
            <EntryCard
              to="/add-company?mode=claim"
              tag="For operators and owners"
              title="Claim, update, or add a listing"
              body="Use the new claim/update workflow with lightweight domain verification and a visible non-technical review path."
              cta="Open company workflow"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <div className="rounded-3xl border border-utah-stone/10 bg-utah-slate p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-utah-stone/45">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-utah-stone">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-utah-stone/68">{body}</p>
    </div>
  );
}

function Signal({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-utah-stone/10 bg-utah-dark/35 p-4">
      <p className="font-semibold text-utah-stone">{title}</p>
      <p className="mt-1 text-sm text-utah-stone/68">{body}</p>
    </div>
  );
}

function EntryCard({
  to,
  tag,
  title,
  body,
  cta,
}: {
  to: string;
  tag: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link to={to} className="card group transition hover:border-utah-gold/60">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-utah-gold">{tag}</p>
      <h2 className="mt-3 font-display text-2xl font-bold leading-tight">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-utah-stone/74">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-utah-gold transition group-hover:gap-2">
        {cta} <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
