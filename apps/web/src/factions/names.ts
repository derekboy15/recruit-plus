/** "Imperium - Adeptus Astartes - Blood Angels" -> "Blood Angels". */
export function factionDisplayName(catalogueName: string): string {
  return catalogueName.replace(/^(Imperium|Chaos|Aeldari|Tyranids|Unaligned) - /, '').replace(/^Adeptus Astartes - /, '');
}
