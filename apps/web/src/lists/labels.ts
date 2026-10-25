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

const sameName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** `base`, else `base 2`, `base 3`…: the first name none of `taken` has (ignoring case and spacing). */
export function uniqueListName(base: string, taken: string[]): string {
  const used = new Set(taken.map(sameName));
  if (!used.has(sameName(base))) return base;
  let n = 2;
  while (used.has(sameName(`${base} ${n}`))) n++;
  return `${base} ${n}`;
}
