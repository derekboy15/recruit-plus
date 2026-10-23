/** A drill, full-window like the game screen: the board, the drill card, and the M5 phase panel driven through the drill. */
import type { CatalogueOut, UnitOut } from '@recruit/data/model';
import { dispatch, type Command, type Problem } from '@recruit/engine';
import { toDatasheet } from '@recruit/engine/data';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCatalogue } from '../../factions/dataClient';
import { BoardCanvas, type RendererFactory } from '../../play/board/BoardCanvas';
import { useBoardUi } from '../../play/game/useBoardUi';
import { PhasePanel } from '../../play/panels/PhasePanel';
import { Problems } from '../../play/panels/Problems';
import { getMissions } from '../../table/missionData';
import { actRun, answerRun, cardView, currentStage, startRun, watchOf, type DrillRun } from './run';
import { drillSandbox } from './sandbox';
import type { Drill, DrillCtx } from './types';
import { DrillCard } from './DrillCard';
import '../../play/play.css';
import '../learn.css';

export interface DrillScreenProps {
  drill: Drill;
  /** Called once when the run is done, with the number of wrong answers. */
  onDone(mistakes: number): void;
  /** "Back to the lesson". */
  exitTo: string;
  next?: { to: string; label: string } | null;
  renderer?: RendererFactory;
  /** Tests: a fixed seed and scripted dice. Default: a random seed. */
  seed?: number;
  dice?: number[];
}

interface Loaded { ctx: Omit<DrillCtx, 'seed' | 'dice'>; catalogues: CatalogueOut[] }

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

async function load(drill: Drill): Promise<Loaded> {
  const [catalogues, missions] = await Promise.all([Promise.all(drill.catalogues.map(getCatalogue)), drill.needsMissions ? getMissions() : Promise.resolve(null)]);
  return {
    catalogues,
    ctx: {
      sheet(slug, unitName) {
        const c = catalogues.find((x) => x.slug === slug);
        const unit = c?.units.find((u) => u.name === unitName);
        if (!c || !unit) throw new Error(`${unitName} isn't in ${slug}`);
        return toDatasheet(unit, c.name).datasheet;
      },
      missions,
    },
  };
}

export function DrillScreen(p: DrillScreenProps) {
  const [loaded, setLoaded] = useState<{ status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & Loaded)>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoaded({ status: 'loading' });
    load(p.drill).then(
      (l) => live && setLoaded({ status: 'ready', ...l }),
      (e: unknown) => live && setLoaded({ status: 'error', message: (e as Error).message }),
    );
    return () => {
      live = false;
    };
  }, [p.drill, attempt]);

  if (loaded.status === 'loading') return <p className="muted">Setting up the drill…</p>;
  if (loaded.status === 'error')
    return (
      <section>
        <p role="alert">The drill couldn&apos;t be set up: {loaded.message}</p>
        <button type="button" className="btn btn--primary" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>{' '}
        <Link to={p.exitTo} className="btn">
          Back to the lesson
        </Link>
      </section>
    );
  return <Running {...p} loaded={loaded} />;
}

function Running({ drill, onDone, exitTo, next = null, renderer, seed, dice, loaded }: DrillScreenProps & { loaded: Loaded }) {
  const fresh = useCallback(
    (s: number) => startRun(drill, { ...loaded.ctx, seed: s, dice: dice ?? [] }),
    [drill, loaded, dice],
  );
  const [run, setRun] = useState<DrillRun>(() => fresh(seed ?? randomSeed()));
  const runRef = useRef(run);
  runRef.current = run;
  const reported = useRef(false);

  useEffect(() => {
    if (run.status === 'done' && !reported.current) {
      reported.current = true;
      onDone(run.mistakes);
    }
  }, [run, onDone]);

  const sb = useMemo(
    () =>
      drillSandbox(
        run,
        (cmd: Command): Problem[] | null => {
          const r = actRun(runRef.current, cmd);
          runRef.current = r.run;
          setRun(r.run);
          return r.problems;
        },
        (cmd: Command): Problem[] => {
          const r = dispatch(runRef.current.record, cmd);
          return r.ok ? [] : r.problems;
        },
      ),
    [run],
  );
  const { ui, scene, canDrag, onTap, onDrag, reset } = useBoardUi(sb);

  const restart = () => {
    reported.current = false;
    reset();
    setRun(fresh(randomSeed()));
  };
  const answer = (id: string) => setRun((r) => answerRun(r, id));
  const unitOut = (unitId: string): UnitOut | null => {
    const name = sb.state.units[unitId]?.name;
    for (const c of loaded.catalogues) {
      const u = c.units.find((x) => x.name === name);
      if (u) return u;
    }
    return null;
  };
  const stage = currentStage(run);
  const asked = stage?.kind === 'ask' ? stage.datasheet?.(watchOf(run)) : undefined;
  const sheetUnit = asked ?? ui.selectedUnitId;
  const sheetOut = sheetUnit ? unitOut(sheetUnit) : null;
  const sheet = sheetOut ? { unit: sheetOut, open: !!asked } : null;
  const showPanel = run.status === 'playing' && stage?.kind === 'do';

  return (
    <div className="game drill">
      <header className="game__top drill__top" aria-label="Drill status">
        <span className="game__where">{drill.title}</span>
        <span className="game__tools">
          <button type="button" className="btn btn--small" onClick={restart}>
            Start again
          </button>
          <Link to={exitTo} className="btn btn--small">
            Back to the lesson
          </Link>
        </span>
      </header>
      <div className="game__board">
        <BoardCanvas
          scene={scene}
          canDrag={canDrag}
          onTap={onTap}
          onDrag={onDrag}
          renderer={renderer}
          label={`Battlefield, ${sb.state.setup.board.w} by ${sb.state.setup.board.h} inches`}
        />
      </div>
      <div className="game__panel">
        <DrillCard key={`${run.seed}-${run.stage}`} view={cardView(run)} onAnswer={answer} onRestart={restart} sheet={sheet} next={next} />
        {showPanel && (
          <>
            <Problems problems={ui.problems} />
            <PhasePanel sb={sb} ui={ui} />
          </>
        )}
      </div>
    </div>
  );
}
