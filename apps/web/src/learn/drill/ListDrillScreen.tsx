/** A list drill (lesson 14): the drill card beside a small army list that the real army builder checks as you add units. */
import { BATTLE_SIZES, COST_PTS, explain, validate } from '@recruit/data/roster';
import type { Problem } from '@recruit/engine';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIndex, getPolicy, getRosterScope } from '../../factions/dataClient';
import { slugsFor } from '../../lists/useRosterEditor';
import { Problems } from '../../play/panels/Problems';
import { DrillCard } from './DrillCard';
import { addUnitRun, answerListRun, listCardView, startListRun, type ListRun } from './listRun';
import type { ListCtx, ListDrill } from './types';
import '../learn.css';

export interface ListDrillScreenProps {
  drill: ListDrill;
  onDone(mistakes: number): void;
  exitTo: string;
  next?: { to: string; label: string } | null;
}

async function load(drill: ListDrill): Promise<ListCtx> {
  const index = await getIndex();
  const cat = index.catalogues.find((c) => c.slug === drill.catalogue);
  if (!cat) throw new Error(`no catalogue ${drill.catalogue}`);
  const slugs = slugsFor({ schema: 1, name: '', catalogueId: cat.id, battleSize: 'combat-patrol', forces: [] }, index.catalogues, cat.slug);
  const [scope, policy] = await Promise.all([getRosterScope(slugs), getPolicy()]);
  return { scope, policy, catalogueId: cat.id };
}

export function ListDrillScreen({ drill, onDone, exitTo, next = null }: ListDrillScreenProps) {
  const [ctx, setCtx] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; ctx: ListCtx }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setCtx({ status: 'loading' });
    load(drill).then(
      (c) => live && setCtx({ status: 'ready', ctx: c }),
      (e: unknown) => live && setCtx({ status: 'error', message: (e as Error).message }),
    );
    return () => {
      live = false;
    };
  }, [drill, attempt]);
  if (ctx.status === 'loading') return <p className="muted">Setting up the drill…</p>;
  if (ctx.status === 'error')
    return (
      <section>
        <p role="alert">The drill couldn&apos;t be set up: {ctx.message}</p>
        <button type="button" className="btn btn--primary" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </section>
    );
  return <Running drill={drill} ctx={ctx.ctx} onDone={onDone} exitTo={exitTo} next={next} />;
}

function Running({ drill, ctx, onDone, exitTo, next }: ListDrillScreenProps & { ctx: ListCtx; next: { to: string; label: string } | null }) {
  const [run, setRun] = useState<ListRun>(() => startListRun(drill, ctx));
  const [problems, setProblems] = useState<Problem[]>([]);
  const reported = useRef(false);
  useEffect(() => {
    if (run.status === 'done' && !reported.current) {
      reported.current = true;
      onDone(run.mistakes);
    }
  }, [run, onDone]);

  const { world } = run;
  const { view, issues } = validate(world.scope, world.roster, world.policy);
  const points = view.total[COST_PTS] ?? 0;
  const limit = BATTLE_SIZES[world.roster.battleSize].points;
  const units = view.forces.flatMap((f) => f.selections.filter((s) => !s.hidden && s.type !== 'upgrade'));
  const restart = () => {
    reported.current = false;
    setProblems([]);
    setRun(startListRun(drill, ctx));
  };

  return (
    <section className="learn drill-list">
      <div className="drill-list__top">
        <h1>{drill.title}</h1>
        <div className="play-row">
          <button type="button" className="btn btn--small" onClick={restart}>
            Start again
          </button>
          <Link to={exitTo} className="btn btn--small">
            Back to the lesson
          </Link>
        </div>
      </div>
      <DrillCard
        key={run.stage}
        view={listCardView(run)}
        onAnswer={(id) => {
          setProblems([]);
          setRun((r) => answerListRun(r, id));
        }}
        onRestart={restart}
        sheet={null}
        next={next}
      />
      <Problems problems={problems} />
      <section aria-label="Your list" className="card drill-list__roster">
        <h2>{world.roster.name}</h2>
        <div className="points" role="meter" aria-label="Points" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={points}>
          <span className="points__text">{`${points} / ${limit} pts`}</span>
        </div>
        <ul aria-label="Units" className="drill-list__units">
          {units.map((u) => (
            <li key={u.sel.id}>
              {u.name} <span className="muted">· {u.total[COST_PTS] ?? 0} pts</span>
            </li>
          ))}
        </ul>
        <h3>Problems</h3>
        <ul aria-label="Problems with this list" className="drill-list__issues">
          {issues.map((i, n) => (
            <li key={`${i.rule}-${n}`}>{explain(i, view, world.scope).text}</li>
          ))}
          {!issues.length && <li className="muted">None: this list is legal.</li>}
        </ul>
      </section>
      {run.status === 'playing' && (
        <div role="group" aria-label="Add a unit" className="drill-list__add">
          <h2>Add a unit</h2>
          {world.picker.map((p) => (
            <button
              key={p.entryId}
              type="button"
              className="btn drill-list__pick"
              onClick={() => {
                const r = addUnitRun(run, p.entryId);
                setRun(r.run);
                setProblems(r.problems ?? []);
              }}
            >
              {p.name} <span className="muted">({p.role})</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
