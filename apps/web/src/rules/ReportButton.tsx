import { useEffect, useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getIndex } from '../factions/dataClient';
import { Panel } from '../lists/Panel';
import { useStorage } from '../storage/StorageContext';
import { PROBLEM_LABELS, saveReport, type ReportProblem, type RulesReport } from './reports';
import { useWording } from './wording';

const THANKS_MS = 3000;

/** "Report a rules error": a sheet asking what's wrong, saved locally and synced with the user's documents. */
export function ReportButton({ target, text }: { target: Omit<RulesReport['target'], 'path'>; text: string }) {
  const { user } = useAuth();
  const { repo } = useStorage();
  const { wording } = useWording();
  const location = useLocation();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<ReportProblem>('wrong');
  const [note, setNote] = useState('');
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!thanks) return;
    const t = setTimeout(() => setThanks(false), THANKS_MS);
    return () => clearTimeout(t);
  }, [thanks]);

  if (!user) return null;

  const close = () => {
    setOpen(false);
    setProblem('wrong');
    setNote('');
    setError(null);
  };
  const send = async () => {
    const dataGeneratedAt = await getIndex().then((i) => i.generatedAt, () => 'unknown');
    try {
      await saveReport(repo, user.id, {
        target: { ...target, path: location.pathname + location.hash },
        problem,
        note: note.trim(),
        wording,
        text,
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
      <button type="button" className="btn btn--quiet" onClick={() => setOpen(true)}>
        Report a rules error
      </button>
      {thanks && (
        <p role="status" className="report__thanks">
          Thanks. We&apos;ve saved your report.
        </p>
      )}
      {open && (
        <Panel title="Report a rules error" kind="sheet" closeLabel="Cancel" onClose={close}>
          <p className="muted">{target.name}</p>
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
          <div className="report__actions">
            <button type="button" className="btn btn--primary" onClick={() => void send()}>
              Send report
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}
