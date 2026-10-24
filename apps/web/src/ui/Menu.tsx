import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconMore } from './icons';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** A route: the item is a link. */
  to?: string;
  /** Destructive: drawn in --danger-text, after a divider. */
  danger?: boolean;
}

export interface MenuProps {
  /** Names the trigger button and the menu. */
  label: string;
  items: MenuItem[];
  /** What the trigger button shows (default the ⋯ icon). The button itself, and its name, stay the menu's. */
  trigger?: ReactNode;
  /** A non-interactive line above the items, such as the signed-in email on the account menu. */
  header?: ReactNode;
}

const GAP = 4;
const EDGE = 8;

/**
 * The ⋯ menu: a 44px icon button that opens a menu under it, aligned right and kept inside the window. Arrow keys,
 * Home and End move between items; Escape closes it and gives focus back to the button; so does a click outside.
 * Menu 45 stacks over sheets (40) and under toasts (50).
 */
export function Menu({ label, items, trigger, header }: MenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);

  const itemEls = () => [...(popup.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const focusItem = (i: number) => {
    const all = itemEls();
    if (all.length) all[(i + all.length) % all.length].focus({ preventScroll: true });
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  // Fixed to the window, so a list card with overflow: hidden can't clip it. Placed before paint, then focused.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = button.current?.getBoundingClientRect();
      const el = popup.current;
      if (!b || !el) return;
      const p = el.getBoundingClientRect();
      const left = Math.max(EDGE, Math.min(b.right - p.width, window.innerWidth - p.width - EDGE));
      const below = b.bottom + GAP;
      const above = b.top - GAP - p.height;
      const top = below + p.height > window.innerHeight - EDGE && above >= EDGE ? above : below;
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
    };
    place();
    focusItem(0);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const all = itemEls();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const keys: Record<string, () => void> = {
      ArrowDown: () => focusItem(at + 1),
      ArrowUp: () => focusItem(at - 1),
      Home: () => focusItem(0),
      End: () => focusItem(all.length - 1),
      // Handled here, so a sheet the menu sits in stays open.
      Escape: () => close(true),
      Tab: () => close(false),
    };
    const run = keys[e.key];
    if (!run) return;
    if (e.key !== 'Tab') {
      e.preventDefault();
      e.stopPropagation();
    }
    run();
  };

  const select = (item: MenuItem) => {
    // Focus goes back to the button first, so a sheet the item opens returns focus there when it closes.
    close(true);
    item.onSelect?.();
  };

  const firstDanger = items.findIndex((i) => i.danger);
  return (
    <div className="menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="btn btn--icon menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger ?? <IconMore size={22} aria-hidden="true" />}
      </button>
      {open && (
        <div
          ref={popup}
          id={id}
          role="menu"
          aria-label={label}
          className="menu__popup"
          onKeyDown={onMenuKey}
        >
          {header && (
            <div role="presentation" className="menu__header">
              {header}
            </div>
          )}
          {items.map((item, i) => {
            const cls = `menu__item${item.danger ? ' menu__item--danger' : ''}`;
            const body = (
              <>
                {item.icon && (
                  <span className="menu__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </>
            );
            return (
              <Fragment key={item.label}>
                {i === firstDanger && i > 0 && <div role="separator" className="menu__divider" />}
                {item.to ? (
                  <Link role="menuitem" tabIndex={-1} className={cls} to={item.to} onClick={() => select(item)}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" role="menuitem" tabIndex={-1} className={cls} onClick={() => select(item)}>
                    {body}
                  </button>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
