/** Browser-safe display names. */

/** A trailing command-point cost on a detachment name: "Battalion Detachment -3CP", "Supreme Command Detachment 0CP". */
const CP_SUFFIX = / -?\d+CP$/;

/** The detachment's name without its CP cost: "Battalion Detachment -3CP" -> "Battalion Detachment". */
export const stripCpSuffix = (name: string): string => name.trim().replace(CP_SUFFIX, '');

/** "Imperium - Adeptus Astartes - Blood Angels" -> "Blood Angels"; drops the broad grouping prefix and the Space Marine chapter prefix. */
export function factionDisplayName(catalogueName: string): string {
  return catalogueName
    .trim()
    .replace(/^(Imperium|Chaos|Aeldari|Tyranids|Unaligned) - /, '')
    .replace(/^Adeptus Astartes - /, '');
}
