/**
 * "Imperium - Adeptus Astartes - Blood Angels" -> "Blood Angels". A copy of the roster engine's factionDisplayName, so
 * the factions pages don't pull the engine into the main bundle (names.test.ts keeps the two in step).
 */
export function factionDisplayName(catalogueName: string): string {
  return catalogueName
    .trim()
    .replace(/^(Imperium|Chaos|Aeldari|Tyranids|Unaligned) - /, '')
    .replace(/^Adeptus Astartes - /, '');
}
