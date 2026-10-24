/** Browser-safe display names. */

/** A trailing command-point cost on a detachment name: "Battalion Detachment -3CP", "Supreme Command Detachment 0CP". */
const CP_SUFFIX = / -?\d+CP$/;

/** The detachment's name without its CP cost: "Battalion Detachment -3CP" -> "Battalion Detachment". */
export const stripCpSuffix = (name: string): string => name.trim().replace(CP_SUFFIX, '');

/**
 * A name from the data as players should read it, without BattleScribe's "*…*" emphasis or "-…-" wrapping:
 * "-Dynastic Code-" -> "Dynastic Code", "* No Psychic Power Selected *" -> "No Psychic Power Selected". Hyphens inside
 * a name are kept. A name that would be left empty is returned as written (trimmed).
 */
export function displayName(name: string): string {
  const cleaned = name.replace(/\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').replace(/\s{2,}/g, ' ');
  return cleaned || name.trim();
}

/** An option's name as a player reads it: the name itself, the kind of option it is ("Warlord trait · Novokh"), and Legends. */
export interface OptionDisplay {
  name: string;
  heading: string | null;
  legends: boolean;
}

/**
 * Kinds of option whose BattleScribe prefix isn't the player's word for them (the survey and decisions are in
 * test/roster-names.test.ts). Any other "Prefix: name" keeps its prefix as the heading.
 */
const KINDS: { re: RegExp; heading: string }[] = [
  { re: /^strat[ae]gems?$/i, heading: 'Stratagem' },
  { re: /^(relics?|heirlooms?)$/i, heading: 'Relic' },
  { re: /^(warlord traits?|wt)$/i, heading: 'Warlord trait' },
  { re: /^arkana$/i, heading: 'Cryptek Arkana' },
  { re: /^power$/i, heading: 'Psychic power' },
];
const kindHeading = (kind: string): string | undefined => KINDS.find((k) => k.re.test(kind))?.heading;

const LEGENDS = /\s*(\[legends[\]}]|\(legends\))\s*/i;
/** A roll-table number in front of a name: "2: ", "6. ", "4 - ". */
const ROLL_NUMBER = /^\d+\s*(?:[.:]|\s-)\s+/;
/** "Kind (Qualifier): rest"; the kind may be missing ("(Vior'la): …"). */
const PREFIXED = /^([^:()]{0,40}?)\s*(?:\(([^)]*)\))?:\s*(\S.*)$/;
const PLACEHOLDER = /^<([^>]+)>$/;

/** "Codex 2" -> "Codex", "BRB 1" -> "Core Book". */
const qualifier = (q: string): string => {
  const base = q.trim().replace(/\s+\d+$/, '');
  return /^brb$/i.test(base) ? 'Core Book' : base;
};

/**
 * A BattleScribe option name as a display name and a heading:
 * "Warlord Trait (Novokh): Blood-Fuelled Fury" -> { name: "Blood-Fuelled Fury", heading: "Warlord trait · Novokh" },
 * "Dynasty: <Custom>" -> { name: "Custom dynasty", heading: "Dynasty" }, "… [Legends]" -> legends. The name is never
 * empty: with nothing left it falls back to displayName of the whole name.
 */
export function optionDisplay(bsName: string): OptionDisplay {
  const legends = LEGENDS.test(bsName);
  let s = bsName.replace(LEGENDS, ' ').trim().replace(/^!/, '').replace(/^\[Reference\]\s*/i, '').replace(ROLL_NUMBER, '');
  let heading: string | null = null;
  const m = PREFIXED.exec(s);
  if (m) {
    const kind = displayName(m[1] ?? '').trim();
    const base = kind ? (kindHeading(kind) ?? kind) : '';
    const q = m[2] !== undefined ? qualifier(m[2]) : '';
    heading = [base, q].filter(Boolean).join(' · ') || null;
    s = m[3].trim().replace(ROLL_NUMBER, '');
    const placeholder = PLACEHOLDER.exec(s);
    if (placeholder && base) s = `${placeholder[1]} ${base.toLowerCase()}`;
    else s = kindHeading(s) ?? s;
  }
  const placeholder = PLACEHOLDER.exec(s);
  if (placeholder) s = placeholder[1];
  const name = s.trim() ? displayName(s) : '';
  return { name: name || displayName(bsName), heading, legends };
}

/** "Imperium - Adeptus Astartes - Blood Angels" -> "Blood Angels"; drops the broad grouping prefix and the Space Marine chapter prefix. */
export function factionDisplayName(catalogueName: string): string {
  return catalogueName
    .trim()
    .replace(/^(Imperium|Chaos|Aeldari|Tyranids|Unaligned) - /, '')
    .replace(/^Adeptus Astartes - /, '');
}
