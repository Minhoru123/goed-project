import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-[28px] border border-utah-gold/20 bg-gradient-to-br from-utah-navy via-utah-dark to-utah-slate p-8 shadow-2xl shadow-black/25 md:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-utah-gold">
          Utah founder infrastructure
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.96] text-utah-stone md:text-6xl">
          A simpler front door to Utah&apos;s startup ecosystem.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-utah-stone/75">
          Start with the navigator, explore the map, or submit a company update. The goal is quick discovery, not more noise.
        </p>
      </section>

      <section className="mt-8">
        <div className="grid gap-4 md:grid-cols-3">
          <EntryCard
            to="/navigator?role=founder"
            tag="For founders"
            title="Find the right support"
            body="Answer a few questions and get matched to relevant Utah programs."
            cta="Open navigator"
          />
          <EntryCard
            to="/map?role=investor"
            tag="For ecosystem search"
            title="Browse the startup map"
            body="Search Utah companies by place, stage, and sector."
            cta="Open map"
          />
          <EntryCard
            to="/add-company?mode=claim"
            tag="For owners and staff"
            title="Add or update a company"
            body="Submit a new listing or request changes to an existing one."
            cta="Open company form"
          />
        </div>
      </section>
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
