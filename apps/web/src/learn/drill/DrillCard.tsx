/** The drill's guide above the phase panel: what to do now, the question, and what happened so far. */
import type { UnitOut } from '@recruit/data/model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Datasheet } from '../../factions/DatasheetPage';
import { currentStage, watchOf, type DrillRun } from './run';

export interface DrillCardProps {
  run: DrillRun;
  onAnswer(choiceId: string): void;
  onRestart(): void;
  /** The catalogue entry for a unit on the board (for "See datasheet"). */
  unitOut(unitId: string): UnitOut | null;
  selectedUnitId: string | null;
  next: { to: string; label: string } | null;
}

export function DrillCard({ run, onAnswer, onRestart, unitOut, selectedUnitId, next }: DrillCardProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const stage = currentStage(run);
  const w = watchOf(run);
  const asked = stage?.kind === 'ask' ? stage.datasheet?.(w) : undefined;
  const sheetUnit = asked ?? selectedUnitId;
  const sheet = sheetUnit ? unitOut(sheetUnit) : null;

  return (
    <section aria-label="Drill" className="drill-card">
      {run.status === 'done' && <h2>Drill complete</h2>}
      {run.results.length === 0 && run.status === 'playing' && <p className="drill-card__intro">{run.drill.intro}</p>}
      {run.results.length > 0 && (
        <ol className="drill-card__results">
          {run.results.map((r) => (
            <li key={r.stageId}>{r.explain}</li>
          ))}
        </ol>
      )}
      {stage?.kind === 'do' && (
        <p className="drill-card__task" role="status">
          {stage.prompt(w)}
        </p>
      )}
      {stage?.kind === 'ask' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (choice) onAnswer(choice);
          }}
        >
          <fieldset className="choices drill-card__question">
            <legend>{stage.question(w)}</legend>
            {stage.choices(w).map((c) => (
              <label key={c.id} className="choices__option drill-card__choice">
                <input type="radio" name={`drill-${stage.id}`} value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} />
                {c.label}
              </label>
            ))}
          </fieldset>
          {run.wrong && (
            <p role="alert" className="drill-card__wrong">
              {run.wrong}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={!choice}>
            Check answer
          </button>
        </form>
      )}
      {run.status === 'failed' && (
        <div className="drill-card__failed">
          <p role="alert">{run.failure}</p>
          <button type="button" className="btn btn--primary" onClick={onRestart}>
            Try again
          </button>
        </div>
      )}
      {run.status === 'done' && (
        <div className="play-row">
          {next && (
            <Link to={next.to} className="btn btn--primary">
              {next.label}
            </Link>
          )}
          <Link to="/learn" className="btn">
            Back to Learn
          </Link>
        </div>
      )}
      {sheet && run.status === 'playing' && (
        <details className="play-details drill-card__sheet" open={!!asked}>
          <summary>See datasheet: {sheet.name}</summary>
          <Datasheet unit={sheet} />
        </details>
      )}
    </section>
  );
}
