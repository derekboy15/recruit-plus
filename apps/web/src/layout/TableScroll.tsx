import type { CSSProperties, ReactNode } from 'react';

/**
 * A table that may be wider than a phone: it scrolls sideways on its own. It is a labelled, focusable region so
 * keyboard users can reach it and scroll it with the arrow keys (WCAG 2.1.1).
 */
export function TableScroll({ label, style, children }: { label: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0} style={style}>
      {children}
    </div>
  );
}
