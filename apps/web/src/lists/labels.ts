import { displayName } from '@recruit/data/roster';

/**
 * A BattleScribe group or army-option title as players should read it: no "**…**" or "-…-" decoration (the engine's
 * `displayName`, which option names use too), and no trailing "Selection"/"Selector" ("Chapter Selection" ->
 * "Chapter"). Empty when nothing is left ("Selection"): callers fall back to another name.
 */
export function cleanLabel(name: string): string {
  return displayName(name)
    .replace(/(^|\s+)(selections?|selector)$/i, '')
    .trim();
}
