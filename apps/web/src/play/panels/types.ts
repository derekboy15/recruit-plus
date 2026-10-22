import type { Problem, Pt } from '@recruit/engine';
import type { Ring } from '../board/scene';
import type { Plan, PlanAction } from '../game/plan';
import type { Sandbox } from '../game/useSandbox';

export type ReadySandbox = Extract<Sandbox, { status: 'ready' }>;
export type TapHandler = (at: Pt, modelId: string | null) => void;

/** What every phase panel gets: the game, and the board's selection, plan, rings and input handlers. */
export interface PanelProps {
  sb: ReadySandbox;
  ui: {
    selectedUnitId: string | null;
    select(unitId: string | null): void;
    plan: Plan | null;
    planDispatch(a: PlanAction): void;
    /** True while a model is being dragged (panels dry-run the plan when it ends, not on every move). */
    dragging: boolean;
    setRings(r: Ring[]): void;
    setTargets(ids: string[]): void;
    setInvalid(ids: string[]): void;
    /** Panels set this to receive board taps (e.g. "tap where to set up"); null restores unit selection. */
    setTapHandler(fn: TapHandler | null): void;
    /** Which models the board lets the player drag right now; null: the planned ones. */
    setDraggable(fn: ((modelId: string) => boolean) | null): void;
    problems: Problem[];
    setProblems(p: Problem[]): void;
  };
}
