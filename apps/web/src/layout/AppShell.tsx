import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from './Footer';
import { NavBar } from './NavBar';

export function AppShell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          RECRUIT<span>+</span>
        </Link>
        {account}
      </header>
      <NavBar />
      <main className="shell__main">{children}</main>
      <Footer />
    </div>
  );
}
