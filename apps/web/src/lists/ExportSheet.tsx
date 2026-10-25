import { liveQuery } from 'dexie';
import { exportText, UNTITLED_LIST, type RosterView, type Scope } from '@recruit/data/roster';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import { setListPublic, type ListData } from './listStore';
import { Sheet } from '../ui/Sheet';
import { usePublicSource } from './publicSource';

const CONFIRM_MS = 2000;

/** A button that copies `text` and says "Copied" for two seconds (or that it couldn't, e.g. clipboard blocked). */
export function CopyButton({ text, label, failedLabel = 'Couldn’t copy', className = 'btn' }: { text: string; label: string; failedLabel?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), CONFIRM_MS);
  };
  return (
    <button type="button" className={className} onClick={() => void copy()}>
      {state === 'copied' ? 'Copied' : state === 'failed' ? failedLabel : label}
    </button>
  );
}

/** Saves `text` as a .txt file, built in the browser (nothing is sent anywhere). */
function downloadText(listName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${listName.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-') || 'army-list'}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "Share…": the device's own share sheet (messages, mail…), only where the browser has one. */
function NativeShare({ data }: { data: ShareData }) {
  const [error, setError] = useState<string | null>(null);
  if (typeof navigator.share !== 'function') return null;
  const share = async () => {
    setError(null);
    try {
      await navigator.share(data);
    } catch (e) {
      // Closing the share sheet without sharing is not an error.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => void share()}>
        Share…
      </button>
      {error && <p role="alert" className="field-error">{`Couldn’t share: ${error}`}</p>}
    </>
  );
}

/** The list as plain text, ready to paste into a chat or a tournament form. */
export function ExportSheet({ view, scope, onClose }: { view: RosterView; scope: Scope; onClose: () => void }) {
  const text = useMemo(() => exportText(view, scope), [view, scope]);
  return (
    <Sheet title="Export list" kind="full" closeLabel="Done" onClose={onClose}>
      <textarea
        className="input export-text export-text--wrap"
        wrap="soft"
        readOnly
        aria-label="List text"
        value={text}
        rows={Math.min(24, text.split('\n').length + 1)}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="sheet-actions">
        <CopyButton text={text} label="Copy" failedLabel="Couldn’t copy. Use Download instead." className="btn btn--primary" />
        <button type="button" className="btn" onClick={() => downloadText(view.roster.name, text)}>
          Download .txt
        </button>
        <NativeShare data={{ title: view.roster.name.trim() || UNTITLED_LIST, text }} />
      </div>
    </Sheet>
  );
}

/** Whether the list is shared right now (null until the first read), kept in step with the local database. */
function useIsShared(repo: Repository, listId: string) {
  const [shared, setShared] = useState<boolean | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => repo.getDoc<ListData>(listId)).subscribe({
      next: (doc) => setShared(doc?.isPublic ?? false),
      error: () => setShared(false),
    });
    return () => sub.unsubscribe();
  }, [repo, listId]);
  return [shared, setShared] as const;
}

/** The "Anyone with the link can view" switch and, while it is on, the link to copy. */
export function ShareSheet({ listId, title = UNTITLED_LIST, flush, onClose }: { listId: string; title?: string; flush: () => Promise<void>; onClose: () => void }) {
  const { repo } = useStorage();
  const { linksWorkAnywhere } = usePublicSource();
  const [stored, setStored] = useIsShared(repo, listId);
  // The switch's new position while it is being saved: shown at once, and kept even when saving the pending edits
  // first reports the old setting back from the database.
  const [saving, setSaving] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const link = `${window.location.origin}/share/${listId}`;
  const shared = saving ?? stored;

  const toggle = async (on: boolean) => {
    setSaving(on);
    setError(null);
    try {
      // Unsaved edits are saved first, so turning sharing on never saves an older copy over them.
      await flush();
      await setListPublic(repo, listId, on);
      setStored(on); // the database confirms it a moment later
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Sheet title="Share list" kind="full" closeLabel="Done" onClose={onClose}>
      <label className="choices__option">
        <input type="checkbox" checked={shared === true} disabled={shared === null || saving !== null} onChange={(e) => void toggle(e.target.checked)} />
        <span>Anyone with the link can view</span>
      </label>
      <p className="muted">
        They see a read-only copy and don’t need to sign in. Turn sharing off here at any time.
      </p>
      {error && <p role="alert">{`Couldn’t change sharing: ${error.message}`}</p>}
      {shared && (
        <>
          <input className="input" readOnly aria-label="Share link" value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="sheet-actions">
            <CopyButton text={link} label="Copy link" failedLabel="Couldn’t copy. Select the link instead." className="btn btn--primary" />
            <NativeShare data={{ title, url: link }} />
          </div>
          {!linksWorkAnywhere && <p className="muted">Share links work on other devices once accounts are switched on.</p>}
        </>
      )}
    </Sheet>
  );
}
