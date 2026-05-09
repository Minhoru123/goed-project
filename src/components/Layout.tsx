import { NavLink, Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.08),_transparent_28%),linear-gradient(180deg,_#08111f_0%,_#0F172A_28%,_#0F172A_100%)]">
      <header className="sticky top-0 z-40 border-b border-utah-stone/10 bg-utah-dark/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3 font-display text-lg font-bold text-utah-stone">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-utah-gold/30 bg-utah-gold/10 text-sm text-utah-gold" aria-hidden>
              UT
            </span>
            <span>Utah Startup State</span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
              <NavItem to="/navigator">Navigator</NavItem>
              <NavItem to="/map">Map</NavItem>
              <NavItem to="/add-company">Add company</NavItem>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-utah-stone/10 bg-utah-dark/70">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-sm text-utah-stone/55">
          Utah startup discovery for founders, operators, and ecosystem partners.
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 transition ${
          isActive ? 'bg-utah-gold/12 text-utah-gold' : 'text-utah-stone/70 hover:bg-utah-stone/6 hover:text-utah-stone'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
