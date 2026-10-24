import { useState, type ReactNode } from 'react';
import { IconInfo } from './icons';
import { Sheet } from './Sheet';

/** The ⓘ pattern: a 44px icon button named by `label` that opens the full text in a bottom sheet titled `title`. */
export function InfoButton({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--icon info-btn" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <IconInfo size={20} aria-hidden="true" />
      </button>
      {open && (
        <Sheet kind="sheet" title={title} onClose={() => setOpen(false)}>
          {children}
        </Sheet>
      )}
    </>
  );
}
