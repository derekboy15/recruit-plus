/**
 * Shared engine contracts. Commands and events are open maps: each rules module adds its own members with
 * `declare module '../core/types' { interface CommandMap { … } interface EventMap { … } }`, so the unions below
 * always list every command and event the engine knows.
 */
import type { GameRecord } from './record';

export type PlayerId = 'A' | 'B';
export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A');

/** Why a command was refused, in plain English for a newcomer, with the rule it comes from (a citation tag). */
export interface Problem { code: string; message: string; rule: string; unitId?: string; modelIds?: string[] }
export interface Rejected { ok: false; problems: Problem[] }
export interface Accepted { ok: true; game: GameRecord; events: GameEvent[] }
export type DispatchResult = Accepted | Rejected;

/** Every command names the player issuing it. */
export interface Cmd<T extends string> { type: T; by: PlayerId }
export interface Evt<T extends string> { type: T }

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CommandMap {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EventMap {}
export type CommandType = keyof CommandMap;
export type EventType = keyof EventMap;
export type Command = CommandMap[keyof CommandMap];
export type GameEvent = EventMap[keyof EventMap];
