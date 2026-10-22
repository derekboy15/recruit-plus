/** The single reducer: apply(state, event) mutates a draft state. Each module registers the events it owns. */
import type { EventMap, EventType, GameEvent } from './types';
import type { GameState } from './state';

type Applier<E> = (s: GameState, e: E) => void;
const appliers = new Map<string, Applier<never>>();

export function registerApplier<T extends EventType>(type: T, f: Applier<EventMap[T]>): void {
  appliers.set(type, f as Applier<never>);
}
export const hasApplier = (type: string) => appliers.has(type);

export function apply(s: GameState, e: GameEvent): void {
  const f = appliers.get((e as { type: string }).type) as Applier<GameEvent> | undefined;
  if (!f) throw new Error(`Unknown event type "${(e as { type: string }).type}"`);
  f(s, e);
}
