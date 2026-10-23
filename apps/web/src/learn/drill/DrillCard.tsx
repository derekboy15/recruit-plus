/** The drill's guide above the phase panel: what to do now, the question, and what happened so far. */
import type { UnitOut } from '@recruit/data/model';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Datasheet } from '../../factions/DatasheetPage';
import { DiceTray } from '../../play/panels/DiceTray';
import type { CardView } from './types';

export interface DrillCardProps {
  view: CardView;
  onAnswer(choiceId: string): void;
  onRestart(): void;
  /** A datasheet to offer ("See datasheet"); open at once when the question is about it. */
  sheet: { unit: UnitOut; open: boolean } | null;
  next: { to: string; label: string } | null;
}

export function DrillCard({ view, onAnswer, onRestart, sheet, next }: DrillCardProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const { stage } = view;

  return (
    <section aria-label="Drill" className="drill-card">
      {view.status === 'done' && <h2>Drill complete</h2>}
      {view.results.length === 0 && view.status === 'playing' && <p className="drill-card__intro">{view.intro}</p>}
      {view.results.length > 0 && (
        <ol className="drill-card__results">
          {view.results.map((r) => (
            <li key={r.stageId}>{r.explain}</li>
          ))}
        </ol>
      )}
      {stage?.kind === 'do' && (
        <p className="drill-card__task" role="status">
          {stage.prompt}
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
            <legend>{stage.question}</legend>
            {view.dice && <DiceTray dice={view.dice.dice} rollKey={view.dice.key} />}
            {stage.choices.map((c) => (
              <label key={c.id} className="choices__option drill-card__choice">
                <input type="radio" name={`drill-${stage.id}`} value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} />
                {c.label}
              </label>
            ))}
          </fieldset>
          {view.wrong && (
            <p role="alert" className="drill-card__wrong">
              {view.wrong}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={!choice}>
            Check answer
          </button>
        </form>
      )}
      {view.status === 'failed' && (
        <div className="drill-card__failed">
          <p role="alert">{view.failure}</p>
          <button type="button" className="btn btn--primary" onClick={onRestart}>
            Try again
          </button>
        </div>
      )}
      {view.status === 'done' && (
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
      {sheet && view.status === 'playing' && (
        <details className="play-details drill-card__sheet" open={sheet.open}>
          <summary>See datasheet: {sheet.unit.name}</summary>
          <Datasheet unit={sheet.unit} />
        </details>
      )}
    </section>
  );
}
