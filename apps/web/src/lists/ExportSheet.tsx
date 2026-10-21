import { liveQuery } from 'dexie';
import { exportText, type RosterView, type Scope } from '@recruit/data/roster';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Repository } from '../storage/repository';
import { useStorage } from '../storage/StorageContext';
import { setListPublic, type ListData } from './listStore';
import { Panel } from './Panel';
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

/** The list as plain text, ready to paste into a chat or a tournament form. */
export function ExportSheet({ view, scope, onClose }: { view: RosterView; scope: Scope; onClose: () => void }) {
  const text = useMemo(() => exportText(view, scope), [view, scope]);
  return (
    <Panel title="Export list" kind="full" closeLabel="Done" onClose={onClose}>
      <textarea
        className="input export-text"
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
      </div>
    </Panel>
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
export function ShareSheet({ listId, flush, onClose }: { listId: string; flush: () => Promise<void>; onClose: () => void }) {
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
    <Panel title="Share list" kind="full" closeLabel="Done" onClose={onClose}>
      <label className="choices__option">
        <input type="checkbox" checked={shared === true} disabled={shared === null || saving !== null} onChange={(e) => void toggle(e.target.checked)} />
        <span>Anyone with the link can view</span>
      </label>
      <p className="muted">
        They see a read-only copy and don’t need to sign in. Turning sharing off makes the link stop working after your next sync.
      </p>
      {error && <p role="alert">{`Couldn’t change sharing: ${error.message}`}</p>}
      {shared && (
        <>
          <input className="input" readOnly aria-label="Share link" value={link} onFocus={(e) => e.currentTarget.select()} />
          <div className="sheet-actions">
            <CopyButton text={link} label="Copy link" failedLabel="Couldn’t copy. Select the link instead." className="btn btn--primary" />
          </div>
          {!linksWorkAnywhere && <p className="muted">Share links work on other devices once accounts are switched on.</p>}
        </>
      )}
    </Panel>
  );
}
