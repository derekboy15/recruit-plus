import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconBack } from './icons';

export interface PageHeaderProps {
  /** Rendered in the page's <h1>. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Back goes to an explicit parent route, never browser history. */
  back?: { to: string; label: string };
  /** Icon buttons, a Menu, at most one primary action. */
  actions?: ReactNode;
  /** 'top': a tab's own page, large title and no Back. 'sub' (default): a page below a tab. */
  variant?: 'top' | 'sub';
}

/** Every page's header: Back, the title and the page's actions. It sticks to the top while the page scrolls. */
export function PageHeader({ title, subtitle, back, actions, variant = 'sub' }: PageHeaderProps) {
  return (
    <header className={`page-head page-head--${variant}`}>
      {variant === 'sub' && back && (
        <Link to={back.to} className="btn btn--icon page-head__back" aria-label={`Back to ${back.label}`}>
          <IconBack size={24} aria-hidden="true" />
        </Link>
      )}
      <div className="page-head__titles">
        <h1 className="page-head__title">{title}</h1>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}
