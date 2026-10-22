/** Test-only: renders a phase panel over a live in-memory game, with the board's taps and drags driven by the test. */
import { currentStep, dispatch, gameLog, stateOf, undo, type GameRecord, type Problem, type Pt } from '@recruit/engine';
import { act, render } from '@testing-library/react';
import { useMemo, useReducer, useRef, useState, type ComponentType } from 'react';
import { WordingProvider } from '../../rules/wording';
import type { Ring } from '../board/scene';
import { planReducer, type Plan } from '../game/plan';
import type { GameMeta } from '../store/gameStore';
import type { PanelProps, ReadySandbox, TapHandler } from '../panels/types';

export const META: GameMeta = {
  title: 'Necrons vs Ultramarines',
  createdAt: 1,
  hints: true,
  handOver: true,
  missionId: 'practice',
  layoutId: 'open',
  armies: [
    { player: 'A', listId: 'l1', name: 'Necrons', faction: 'Necrons', catalogueSlugs: ['necrons'] },
    { player: 'B', listId: 'l2', name: 'Ultramarines', faction: 'Ultramarines', catalogueSlugs: ['imperium-adeptus-astartes-ultramarines'] },
  ],
};

export interface PanelHarness {
  record(): GameRecord;
  plan(): Plan | null;
  rings(): Ring[];
  targets(): string[];
  invalid(): string[];
  problems(): Problem[];
  selected(): string | null;
  /** A tap on the board, as the board would report it. */
  tap(at: Pt, modelId?: string | null): void;
  /** A finished drag of a planned model to a new centre. */
  drag(modelId: string, to: Pt): void;
  canDrag(modelId: string): boolean;
}

export function renderPanel(Panel: ComponentType<PanelProps>, start: GameRecord, meta: GameMeta = META): PanelHarness & ReturnType<typeof render> {
  const out = {} as PanelHarness;
  function Harness() {
    const [record, setRecord] = useState(start);
    const recordRef = useRef(record);
    const [plan, planDispatch] = useReducer(planReducer, null);
    const [selectedUnitId, select] = useState<string | null>(null);
    const [rings, setRings] = useState<Ring[]>([]);
    const [targets, setTargets] = useState<string[]>([]);
    const [invalid, setInvalid] = useState<string[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [dragging, setDragging] = useState(false);
    const tapRef = useRef<TapHandler | null>(null);
    const dragRef = useRef<((id: string) => boolean) | null>(null);
    const state = stateOf(record);
    const sb = useMemo((): ReadySandbox => {
      const commit = (g: GameRecord) => {
        recordRef.current = g;
        setRecord(g);
      };
      return {
        status: 'ready',
        doc: { id: 'g1', kind: 'game', ownerId: 'u', updatedAt: 1, deleted: false, isPublic: false, dirty: false, data: { record, meta, summary: { round: 0, phase: 'pre-battle', ended: false, winner: null, vp: { A: 0, B: 0 } } } },
        record,
        state,
        step: currentStep(state),
        get log() {
          return gameLog(record);
        },
        act(cmd) {
          const r = dispatch(recordRef.current, cmd);
          if (!r.ok) return r.problems;
          commit(r.game);
          return null;
        },
        check(cmd) {
          const r = dispatch(recordRef.current, cmd);
          return r.ok ? [] : r.problems;
        },
        undo() {
          const r = undo(recordRef.current);
          if (!r.ok) return r.problems;
          commit(r.game);
          return null;
        },
        setMeta() {},
        flush: async () => {},
        saveError: null,
      };
    }, [record, state]);
    const ui: PanelProps['ui'] = {
      selectedUnitId,
      select,
      plan,
      planDispatch,
      dragging,
      setRings,
      setTargets,
      setInvalid,
      setTapHandler: (fn) => (tapRef.current = fn),
      setDraggable: (fn) => (dragRef.current = fn),
      problems,
      setProblems,
    };
    Object.assign(out, {
      record: () => recordRef.current,
      plan: () => plan,
      rings: () => rings,
      targets: () => targets,
      invalid: () => invalid,
      problems: () => problems,
      selected: () => selectedUnitId,
      tap: (at: Pt, modelId: string | null = null) => act(() => (tapRef.current ? tapRef.current(at, modelId) : select(modelId ? state.models[modelId].unitId : null))),
      drag: (modelId: string, to: Pt) =>
        act(() => {
          setDragging(true);
          planDispatch({ type: 'drag', modelId, to });
          setDragging(false);
        }),
      canDrag: (modelId: string) => (dragRef.current ? dragRef.current(modelId) : !!plan?.positions[modelId]),
    });
    return <Panel sb={sb} ui={ui} />;
  }
  const utils = render(
    <WordingProvider initial="plain">
      <Harness />
    </WordingProvider>,
  );
  return Object.assign(utils, out, {
    record: () => out.record(),
    plan: () => out.plan(),
    rings: () => out.rings(),
    targets: () => out.targets(),
    invalid: () => out.invalid(),
    problems: () => out.problems(),
    selected: () => out.selected(),
    tap: (at: Pt, modelId?: string | null) => out.tap(at, modelId),
    drag: (modelId: string, to: Pt) => out.drag(modelId, to),
    canDrag: (modelId: string) => out.canDrag(modelId),
  });
}
