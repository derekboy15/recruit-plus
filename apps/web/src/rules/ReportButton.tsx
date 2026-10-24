import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getIndex } from '../factions/dataClient';
import { useStorage } from '../storage/StorageContext';
import { Sheet } from '../ui/Sheet';
import { PROBLEM_LABELS, saveReport, type ReportProblem, type RulesReport } from './reports';
import { useWording } from './wording';

const THANKS_MS = 3000;

/** One item on a page that can be reported: its name and the text shown for it. */
export interface ReportPart { name: string; text: string }

/**
 * "Report a problem", once per page: a sheet asking what's wrong (and, on a page of several items, which one), saved
 * locally and synced with the user's documents.
 */
export function ReportButton({ target, text, parts }: {
  /** The kind of thing reported and the page's name. */
  target: Omit<RulesReport['target'], 'path'>;
  /** Used when there are no parts. */
  text: string;
  /** Several items on one page: the sheet asks "Which part?"; the saved target name and text are the chosen part's. */
  parts?: ReportPart[];
}) {
  const { user } = useAuth();
  const { repo } = useStorage();
  const { wording } = useWording();
  const location = useLocation();
  const noteId = useId();
  const partId = useId();
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState(0);
  const [problem, setProblem] = useState<ReportProblem>('wrong');
  const [note, setNote] = useState('');
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!thanks) return;
    const t = setTimeout(() => setThanks(false), THANKS_MS);
    return () => clearTimeout(t);
  }, [thanks]);

  if (!user || parts?.length === 0) return null;
  const chosen = parts ? parts[Math.min(part, parts.length - 1)] : null;

  const close = () => {
    setOpen(false);
    setPart(0);
    setProblem('wrong');
    setNote('');
    setError(null);
  };
  const send = async () => {
    const dataGeneratedAt = await getIndex().then((i) => i.generatedAt, () => 'unknown');
    try {
      await saveReport(repo, user.id, {
        target: { ...target, name: chosen?.name ?? target.name, path: location.pathname + location.hash },
        problem,
        note: note.trim(),
        wording,
        text: chosen?.text ?? text,
        dataGeneratedAt,
      });
      close();
      setThanks(true);
    } catch (e) {
      setError(`Couldn't save your report: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="report">
      <button type="button" className="btn btn--tertiary" onClick={() => setOpen(true)}>
        Report a problem
      </button>
      {thanks && (
        <p role="status" className="report__thanks">
          Thanks. We&apos;ve saved your report.
        </p>
      )}
      {open && (
        <Sheet
          title="Report a problem"
          kind="sheet"
          closeLabel="Cancel"
          onClose={close}
          footer={
            <button type="button" className="btn btn--primary" onClick={() => void send()}>
              Send report
            </button>
          }
        >
          {parts ? (
            <div className="report__part">
              <label htmlFor={partId}>Which part?</label>
              <select id={partId} className="input" value={part} onChange={(e) => setPart(Number(e.target.value))}>
                {parts.map((p, i) => (
                  <option key={i} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="muted">{target.name}</p>
          )}
          <fieldset className="choices">
            <legend>What&apos;s wrong?</legend>
            {(Object.keys(PROBLEM_LABELS) as ReportProblem[]).map((p) => (
              <label key={p} className="choices__option">
                <input type="radio" name="problem" value={p} checked={problem === p} onChange={() => setProblem(p)} />
                {PROBLEM_LABELS[p]}
              </label>
            ))}
          </fieldset>
          <label htmlFor={noteId}>Tell us more (optional)</label>
          <textarea id={noteId} className="input" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p role="alert">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}
