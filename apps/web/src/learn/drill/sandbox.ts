/** The M5 phase panels' view of a drill run: what they send goes through the drill controller. */
import { currentStep, gameLog, stateOf, type Command, type Problem } from '@recruit/engine';
import type { ReadySandbox } from '../../play/panels/types';
import type { GameMeta } from '../../play/store/gameStore';
import type { DrillRun } from './run';

const NO_UNDO: Problem[] = [{ code: 'drill', message: 'Use Start again in a drill.', rule: '' }];

export function drillSandbox(run: DrillRun, onAct: (cmd: Command) => Problem[] | null, check: (cmd: Command) => Problem[]): ReadySandbox {
  const record = run.record;
  const state = stateOf(record);
  const meta: GameMeta = {
    title: run.drill.title,
    createdAt: 0,
    hints: false,
    handOver: false,
    missionId: 'drill',
    layoutId: 'drill',
    armies: state.setup.armies.map((a) => ({ player: a.player, listId: `drill-${a.player}`, name: a.name, faction: a.name, catalogueSlugs: run.drill.catalogues })),
  };
  return {
    status: 'ready',
    doc: {
      id: `drill-${run.drill.id}`,
      kind: 'game',
      ownerId: '',
      updatedAt: 0,
      deleted: false,
      isPublic: false,
      dirty: false,
      data: { record, meta, summary: { round: state.round, phase: state.phase, ended: !!state.ended, winner: null, vp: { A: 0, B: 0 } } },
    },
    record,
    state,
    step: currentStep(state),
    get log() {
      return gameLog(record);
    },
    act: onAct,
    check,
    undo: () => NO_UNDO,
    setMeta() {},
    flush: async () => {},
    saveError: null,
  };
}
