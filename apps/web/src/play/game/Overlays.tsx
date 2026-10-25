/** The game screen's overlays: the pass-the-device screen, and the game log and menu (sheets over the game). */
import type { LogLine, PlayerId } from '@recruit/engine';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WordingToggle } from '../../rules/wording';
import { Sheet } from '../../ui/Sheet';
import { logGroups } from './logGroups';

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal over the game that only its own buttons close (the pass-the-device screen). Focus moves into it when it opens
 * (unless a child takes it with autoFocus), Tab and Shift+Tab stay inside it, and focus goes back to whatever had it
 * before when it closes.
 */
export function Dialog({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const dialog = ref.current;
      if (!dialog || e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <div className="game__overlay">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`game__dialog ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function HandOver({ name, onDone }: { name: string; onDone(): void }) {
  return (
    <Dialog label={`Pass the device to ${name}`} className="game__handover">
      <p className="game__handover-text">Pass the device to</p>
      <p className="game__handover-name">{name}</p>
      <button type="button" className="btn btn--primary" onClick={onDone} autoFocus>
        I'm {name}
      </button>
    </Dialog>
  );
}

/** The log, newest phase first, each phase's lines newest first. */
export function GameLog({ lines, onClose }: { lines: LogLine[]; onClose(): void }) {
  return (
    <Sheet title="Game log" onClose={onClose}>
      <div className="game__log">
        {logGroups(lines).map((g) => (
          <section key={g.key}>
            <h3>{g.title}</h3>
            {g.lines.length > 0 && (
              <ol>
                {g.lines.map((l) => (
                  <li key={l.key}>{l.text}</li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </Sheet>
  );
}

export interface MenuProps {
  hints: boolean;
  handOver: boolean;
  setHints(v: boolean): void;
  setHandOver(v: boolean): void;
  armies: { player: PlayerId; name: string }[];
  ended: boolean;
  onConcede(p: PlayerId): void;
  onToolkit?(): void;
  onClose(): void;
}

export function GameMenu({ hints, handOver, setHints, setHandOver, armies, ended, onConcede, onToolkit, onClose }: MenuProps) {
  const [conceding, setConceding] = useState(false);
  return (
    <Sheet title="Menu" onClose={onClose}>
      <label className="choices__option">
        <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />
        <span>Hints for new players</span>
      </label>
      <label className="choices__option">
        <input type="checkbox" checked={handOver} onChange={(e) => setHandOver(e.target.checked)} />
        <span>Pass-the-device screens</span>
      </label>
      <WordingToggle />
      <div className="game__menu-actions">
        {onToolkit && (
          <button type="button" className="btn" onClick={onToolkit}>
            Toolkit
          </button>
        )}
        {!ended &&
          (conceding ? (
            <div role="group" aria-label="Who concedes?">
              <p>Who concedes? The other army wins.</p>
              {armies.map((a) => (
                <button key={a.player} type="button" className="btn btn--danger" onClick={() => onConcede(a.player)}>
                  {a.name} concedes
                </button>
              ))}
              <button type="button" className="btn" onClick={() => setConceding(false)}>
                Keep playing
              </button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConceding(true)}>
              Concede
            </button>
          ))}
        <Link to="/play" className="btn">
          Back to Practice games
        </Link>
      </div>
    </Sheet>
  );
}
