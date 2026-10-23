/**
 * The board's side of a game screen: selection, the move plan, rings, targets, problems and the tap/drag routing the
 * phase panels plug into. Shared by the sandbox's game screen and the Learn drill screen.
 */
import type { Problem, Pt } from '@recruit/engine';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildScene, type BoardScene, type Ring } from '../board/scene';
import type { PanelProps, ReadySandbox, TapHandler } from '../panels/types';
import { planReducer } from './plan';

export interface BoardUi {
  ui: PanelProps['ui'];
  scene: BoardScene;
  canDrag(modelId: string): boolean;
  onTap(at: Pt, modelId: string | null): void;
  onDrag(modelId: string, at: Pt, phase: 'start' | 'move' | 'end' | 'cancel'): void;
  /** Clears selection, plan, rings, targets, invalid models and problems. */
  reset(): void;
}

export function useBoardUi(sb: ReadySandbox): BoardUi {
  const { state } = sb;
  const [selectedUnitId, select] = useState<string | null>(null);
  const [plan, planDispatch] = useReducer(planReducer, null);
  const [rings, setRings] = useState<Ring[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [focusModelId, setFocusModelId] = useState<string | null>(null);
  const tapRef = useRef<TapHandler | null>(null);
  const dragRef = useRef<((modelId: string) => boolean) | null>(null);
  const offset = useRef<Pt>({ x: 0, y: 0 });

  const reset = useCallback(() => {
    select(null);
    planDispatch({ type: 'clear' });
    setRings([]);
    setTargets([]);
    setInvalid([]);
    setProblems([]);
    setFocusModelId(null);
  }, []);

  // A new phase or step starts with a clean board.
  const where = `${state.round}|${state.turn}|${state.phase}|${state.step}`;
  const lastWhere = useRef(where);
  useEffect(() => {
    // Only on a change: on opening the game the panel has already set up what it needs (e.g. a move in progress).
    if (lastWhere.current === where) return;
    lastWhere.current = where;
    reset();
  }, [where, reset]);

  // DEV only: end-to-end tests read the state to find models (BoardCanvas adds their screen positions).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__sandbox = { ...window.__sandbox, state: () => state, plan: () => plan };
  }, [state, plan]);

  const ui: PanelProps['ui'] = useMemo(
    () => ({
      selectedUnitId,
      select,
      plan,
      planDispatch,
      dragging,
      focusModelId,
      setRings,
      setTargets,
      setInvalid,
      setTapHandler: (fn) => {
        tapRef.current = fn;
      },
      setDraggable: (fn) => {
        dragRef.current = fn;
      },
      problems,
      setProblems,
    }),
    [selectedUnitId, plan, dragging, focusModelId, problems],
  );

  const scene = useMemo(
    () => buildScene(state, { selectedUnitId, plan, invalidModelIds: invalid, rings, targetUnitIds: targets }),
    [state, selectedUnitId, plan, invalid, rings, targets],
  );

  const onTap = useCallback(
    (at: Pt, modelId: string | null) => {
      if (tapRef.current) return tapRef.current(at, modelId);
      select(modelId ? state.models[modelId].unitId : null);
    },
    [state],
  );
  const canDrag = useCallback((modelId: string) => (dragRef.current ? dragRef.current(modelId) : !!plan?.positions[modelId]), [plan]);
  const onDrag = useCallback(
    (modelId: string, at: Pt, phase: 'start' | 'move' | 'end' | 'cancel') => {
      const pos = plan?.positions[modelId];
      if (phase === 'start') {
        if (pos) offset.current = { x: pos.x - at.x, y: pos.y - at.y };
        setFocusModelId(modelId);
        setDragging(true);
        return;
      }
      if (phase === 'cancel') return setDragging(false);
      planDispatch({ type: 'drag', modelId, to: { x: at.x + offset.current.x, y: at.y + offset.current.y } });
      if (phase === 'end') setDragging(false);
    },
    [plan],
  );

  return { ui, scene, canDrag, onTap, onDrag, reset };
}
