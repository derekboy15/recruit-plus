import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from './Footer';
import { NavBar } from './NavBar';
import { ReauthBanner } from './ReauthBanner';

export function AppShell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  return (
    <div className="shell">
      {/* Hidden until focused: the first Tab stop jumps past the header and navigation (WCAG 2.4.1). */}
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="topbar">
        <Link to="/" className="topbar__brand">
          RECRUIT<span>+</span>
        </Link>
        {account}
      </header>
      <NavBar />
      <main id="main" tabIndex={-1} className="shell__main">
        <ReauthBanner />
        {children}
      </main>
      <Footer />
    </div>
  );
}
