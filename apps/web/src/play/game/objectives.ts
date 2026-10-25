/**
 * The map's compass codes ("nw", "se2"): ids, or the label a turned map gets from its id (missionAdapter), never a name
 * a player would use.
 */
const COMPASS_CODE = /^(nw|ne|sw|se|n|e|s|w)\d*$/i;

/**
 * What each objective is called on screen. Missions with real labels ("A", "Relic") keep them; objectives that only have
 * an internal id ("a", "n1") or a compass code are numbered 1–n in setup order, so the first game reads like the
 * practice layout and a mission reads the same whether or not its map was turned.
 */
export function objectiveLabels(objectives: { id: string; label?: string }[]): Map<string, string> {
  return new Map(objectives.map((o, i) => [o.id, o.label && !COMPASS_CODE.test(o.label) ? o.label : String(i + 1)]));
}
