/**
 * A BattleScribe option or group name as players should read it: no "**…**" or "-…-" decoration, and no trailing
 * "Selection"/"Selector" ("Chapter Selection" -> "Chapter"). Empty when nothing is left ("Selection"): callers fall
 * back to another name.
 */
export function cleanLabel(name: string): string {
  return name
    .replace(/\*/g, '')
    .replace(/^[-\s]+|[-\s]+$/g, '')
    .replace(/(^|\s+)(selections?|selector)$/i, '')
    .trim();
}
