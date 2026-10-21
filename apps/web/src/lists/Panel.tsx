import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A screen over the list editor: full screen (`full`) or a bottom sheet (`sheet`) on phones, the right-hand column
 * from 768px. `inline` is the column's resting content on wide screens (no close button, not a dialog).
 */
export function Panel({ title, kind, inline = false, closeLabel = 'Close', onClose, children }: {
  title: string; kind: 'full' | 'sheet'; inline?: boolean; closeLabel?: string; onClose: () => void; children: ReactNode;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (inline) return;
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [inline, title]);

  return (
    <section role={inline ? 'region' : 'dialog'} aria-labelledby={id} className={`panel panel--${kind}`}>
      <div className="panel__head">
        <h2 id={id} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        {!inline && (
          <button type="button" className="btn" onClick={onClose}>
            {closeLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
