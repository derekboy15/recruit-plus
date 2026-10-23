/**
 * A Learn drill: a scripted scenario on the real engine, then stages the learner works through. `do` stages are
 * actions on the board, judged from the engine's state; `ask` stages are questions whose answers are computed from
 * the live game (the dice on the table, the datasheets, the engine's helpers), never typed in.
 */
import type { MissionsOut } from '@recruit/data/missions';
import type { Command, Datasheet, GameRecord, GameState, PlayerId, Problem } from '@recruit/engine';

export interface DrillCtx {
  /** A real datasheet from a loaded catalogue. */
  sheet(catalogueSlug: string, unitName: string): Datasheet;
  /** The generated mission data (only loaded for drills that need it). */
  missions: MissionsOut | null;
  seed: number;
  /** Dice appended after the scenario's own scripted dice (tests only). */
  dice: number[];
}

/** One thing the learner tried in the current stage. `drill`: a guard's message (the engine never saw it). */
export interface Attempt { cmd: Command; problems: Problem[] | null; drill?: string }

export interface Watch {
  start: GameRecord;
  stageStart: GameRecord;
  record: GameRecord;
  state: GameState;
  /** This stage's attempts, oldest first. */
  attempts: Attempt[];
  /** Earlier ask stages' chosen ids, by stage id. */
  answers: Record<string, string>;
}

export type Verdict = { pass: boolean; explain: string };

export interface Choice { id: string; label: string }

export type Stage =
  | {
      kind: 'do';
      id: string;
      prompt(w: Watch): string;
      /** A message refusing a legal but off-path command ("In this drill, …"), or null to let the engine judge it. */
      guard?(cmd: Command, w: Watch): string | null;
      /** null: keep going. */
      check(w: Watch): Verdict | null;
      skip?(w: Watch): boolean;
    }
  | {
      kind: 'ask';
      id: string;
      question(w: Watch): string;
      choices(w: Watch): Choice[];
      answer(w: Watch): string;
      explain(w: Watch): string;
      skip?(w: Watch): boolean;
      /** A unit whose datasheet the card shows with the question. */
      datasheet?(w: Watch): string;
    };

export interface Drill {
  /** The lesson id. */
  id: string;
  /** e.g. "Charge the Necron Warriors". */
  title: string;
  /** One or two sentences shown before the first stage. */
  intro: string;
  /** Catalogue slugs to load. */
  catalogues: string[];
  needsMissions?: true;
  /** Who the learner commands; 'both' lets them act for either side. */
  learner: PlayerId | 'both';
  build(ctx: DrillCtx): GameRecord;
  stages: Stage[];
  /** The other side's moves: a command, or null to wait for the learner. Default: confirm the other side's open rolls and decline its reactions. */
  auto?(s: GameState, w: Watch): Command | null;
}
