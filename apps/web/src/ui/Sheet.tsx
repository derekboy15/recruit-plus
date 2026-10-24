import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';

export interface SheetProps {
  title: string;
  onClose: () => void;
  /** Phone: a bottom sheet (max 85vh) or full screen. From 768px both are a 480px right-hand drawer. */
  kind?: 'sheet' | 'full';
  /** From 768px only: a resting side column (no backdrop, no close button, not a dialog). */
  inline?: boolean;
  /** The close button's name (default 'Close'). */
  closeLabel?: string;
  /** Pinned to the bottom of the sheet: the sheet's primary action. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Open sheets by the order they rendered in. A parent renders before the sheets inside it and an earlier sheet before
 * a later one, so the highest number is the top sheet: Escape closes only that one, and nested sheets close one by one.
 */
const openSheets = new Set<number>();
let rendered = 0;
const isTop = (order: number) => Math.max(...openSheets) === order;

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';

/** What Tab can reach inside `root`, in order: not tabindex -1, not hidden, not inside a closed <details>. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => {
    if (el.tabIndex < 0 || el.closest('[hidden], [inert]')) return false;
    const closed = el.closest('details:not([open])');
    return !closed || (el.tagName === 'SUMMARY' && el.parentElement === closed);
  });
}

/**
 * A sheet over the page. It is a dialog named by its title, takes focus on its heading, closes on Escape and on the
 * backdrop, and gives focus back to whatever had it when it opened. It renders into <body>, so a sheet opened from a
 * sticky header still stacks above the tab bar: backdrop 39, sheet 40 (theme.css).
 */
export function Sheet({ title, onClose, kind = 'sheet', inline = false, closeLabel = 'Close', footer, children }: SheetProps) {
  const id = useId();
  const [order] = useState(() => ++rendered);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // Declared first, so it sees the opener before the heading below takes focus.
  useEffect(() => {
    if (inline) return;
    const opener = document.activeElement;
    openSheets.add(order);
    const onKey = (e: KeyboardEvent) => {
      // A menu inside the sheet handles its own Escape first.
      if (e.key === 'Escape' && !e.defaultPrevented && isTop(order)) close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets.delete(order);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [inline, order]);

  useEffect(() => {
    // A sheet opened together with one inside it leaves focus to the inner one.
    if (!inline && isTop(order)) heading.current?.focus();
  }, [inline, order, title]);

  // A modal keeps Tab inside it: past the last control back to the first, and Shift+Tab the other way round. The
  // heading it opened on counts as the start. (Not `inert` on the page: the Undo toast must stay reachable.)
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (inline || e.key !== 'Tab' || e.defaultPrevented) return;
    const all = tabbables(e.currentTarget);
    if (!all.length) return;
    const active = document.activeElement;
    const [first, last] = [all[0], all[all.length - 1]];
    const wrapTo = e.shiftKey ? (active === first || active === heading.current ? last : null) : active === last ? first : null;
    if (!wrapTo) return;
    e.preventDefault();
    wrapTo.focus();
  };

  const sheet = (
    <>
      {!inline && <button type="button" className="sheet-backdrop" aria-label={closeLabel} tabIndex={-1} onClick={onClose} />}
      <section
        role={inline ? 'region' : 'dialog'}
        aria-modal={inline ? undefined : true}
        aria-labelledby={id}
        className={`sheet sheet--${kind}${inline ? ' sheet--inline' : ''}`}
        onKeyDown={onKeyDown}
      >
        <div className="sheet__head">
          <h2 id={id} ref={heading} tabIndex={-1} className="sheet__title">
            {title}
          </h2>
          {!inline && (
            <button type="button" className="btn btn--icon sheet__close" aria-label={closeLabel} onClick={onClose}>
              <IconClose size={22} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </section>
    </>
  );
  return inline ? sheet : createPortal(sheet, document.body);
}
