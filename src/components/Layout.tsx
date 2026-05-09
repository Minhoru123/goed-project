import { NavLink, Outlet, Link } from 'react-router-dom';
import logoUrl from '../assets/logo.png';
import { useAuth } from '../auth/AuthProvider';

export default function Layout() {
  const { isStaff } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-utah-dark text-utah-stone">
      <header className="sticky top-0 z-40 border-b border-utah-stone/10 bg-utah-dark">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/" className="flex items-center gap-3 font-display text-lg font-bold text-utah-stone">
            <img src={logoUrl} alt="" aria-hidden className="h-9 w-9 object-contain" />
            <span>Startup State</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <NavItem to="/" end>Home</NavItem>
            <NavItem to="/navigator">Navigator</NavItem>
            <NavItem to="/map">Map</NavItem>
            <NavItem to="/add-company">Directory</NavItem>
            {isStaff && <NavItem to="/admin">Admin</NavItem>}
          </nav>
          <Link to="/navigator" className="btn-primary text-sm">Find Resources</Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-utah-stone/10 bg-utah-dark text-utah-stone/70">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-sm">
          <p className="font-semibold text-utah-stone">Startup State</p>
          <p className="mt-2 text-utah-stone/60">
            Utah startup discovery for founders, operators, and ecosystem partners.
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `font-semibold transition ${isActive ? 'text-utah-gold' : 'text-utah-stone hover:text-utah-gold'}`
      }
    >
      {children}
    </NavLink>
  );
}
