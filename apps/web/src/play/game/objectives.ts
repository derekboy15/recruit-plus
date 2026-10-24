/**
 * What each objective is called on screen. Missions with real labels ("North") keep them; objectives that only have an
 * internal id ("a", "n1") are numbered 1–n in setup order, so the first game reads like the practice layout.
 */
export function objectiveLabels(objectives: { id: string; label?: string }[]): Map<string, string> {
  return new Map(objectives.map((o, i) => [o.id, o.label ?? String(i + 1)]));
}
