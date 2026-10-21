/** Browser-safe display names. */

/** "Imperium - Adeptus Astartes - Blood Angels" -> "Blood Angels"; drops the broad grouping prefix and the Space Marine chapter prefix. */
export function factionDisplayName(catalogueName: string): string {
  return catalogueName
    .trim()
    .replace(/^(Imperium|Chaos|Aeldari|Tyranids|Unaligned) - /, '')
    .replace(/^Adeptus Astartes - /, '');
}
