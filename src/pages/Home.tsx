import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="bg-utah-dark">
      <section className="flex min-h-[88vh] items-center border-b border-utah-stone/10 bg-utah-dark">
        <div className="mx-auto w-full max-w-7xl px-6 py-32">
          <h1 className="max-w-5xl font-display text-7xl font-bold leading-[1.0] text-utah-stone md:text-[88px]">
            Find your venture's next milestone.
          </h1>
          <p className="mt-8 max-w-2xl text-xl leading-relaxed text-utah-stone/75">
            Match your stage and location to Utah's innovation programs, capital sources, and ecosystem partners.
          </p>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/navigator" className="btn-primary gap-2">
              Find Your Path <span aria-hidden>→</span>
            </Link>
            <Link to="/map" className="btn-secondary">
              Explore the Map
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-center font-display text-3xl font-bold text-utah-stone">Core Ecosystem Pillars</h2>
        <div className="mx-auto mt-3 h-0.5 w-16 bg-utah-gold" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <PillarCard
            to="/navigator"
            title="Founder's Navigator"
            body="Get matched with state programs, capital sources, and ecosystem resources tailored to your venture's stage."
            cta="Launch Navigator"
          />
          <PillarCard
            to="/map"
            title="Interactive Map"
            body="Browse Utah's startup map by sector, stage, and location. Find customers, partners, and acquisition targets."
            cta="Discover Startups"
          />
          <PillarCard
            to="/add-company"
            title="Manage Your Listing"
            body="Claim your company in Utah's directory. Update team size, hiring status, and links so partners can find you."
            cta="Update Data"
          />
        </div>
      </section>
    </div>
  );
}

function PillarCard({
  to,
  title,
  body,
  cta,
}: {
  to: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link to={to} className="card group transition hover:border-utah-gold/60">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-utah-dark text-utah-gold">
        <span className="text-base font-bold">▲</span>
      </div>
      <h3 className="mt-5 font-display text-xl font-bold text-utah-stone">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-utah-stone/80">{body}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-utah-gold transition group-hover:gap-2">
        {cta} <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
