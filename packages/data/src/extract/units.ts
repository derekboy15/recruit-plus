import { buildIdIndex, catalogueScope } from '../bsdata/gamedata';
import type { GameData, RawCatalogue, RawNode } from '../bsdata/types';
import { BATTLEFIELD_ROLES, type AbilityOut, type BattlefieldRole, type EntryGear, type ModelKindOut, type ProfileOut, type UnitOut } from '../model/types';
import { modifiersOf } from '../roster/emit';
import { optionDisplay } from '../roster/names';
import { isUnitLike } from '../roster/options';
import { FORCE, MATCHED_GROUP } from '../roster/policy';
import type { Cond, CondGroup, Mod } from '../roster/types';
import { slugify } from '../text';

/** Crusade content, never part of a datasheet: skipped wherever it is (the roster files drop it too). */
const DROPPED = /^(battle honours|battle scars|crusade|agendas)\b/i;

/**
 * List-building choices, sorted by where they belong. The rule is on the groups and entries between the unit and a
 * profile, never on the weapon's own name: "Relic Gauss Blaster" is the Royal Warden's own weapon, "Relic blade" an
 * Honour Guard's, and "Relic Terminator Squad" a unit.
 *
 * Evidence (the group and entry names on the path to every weapon and ability in Necrons, Ultramarines, Orks, Astra
 * Militarum and Chaos Space Marines, then every group name in every catalogue, 2026-10-24):
 * - relic-type options (EXTRA_*): groups named "Relics", "Chapter Relics", "Relics of Macragge", "Sacred Relics of the
 *   Cult", "Artefacts of the Aeons", "Bio-artefacts", "Heirlooms of Conquest", "Corrupted Heirloom", "Treasures of the
 *   Aeldari", "Trophies of the Long War", "Relic Bearers", "Shiny Gubbinz", "Signature Systems", "Prototype Systems",
 *   "Gifts of the Prescient", "Special-Issue Wargear" / "Special Issue - …", "Vehicle Kustom Jobs", "Chapter Command",
 *   Army of Renown choices; entries named "Relic: …", "Relic (Sautekh): …", "Chapter Command: …";
 * - the army's other options (OPTION_*): Warlord traits ("Warlord Traits (…)", "Codex Traits", "Shield Host Trait",
 *   "Visions of the Augurium"), stratagem and requisition upgrades ("Stratagems", "Character Stratagems", "Specialist
 *   Mobs", "Specialist Detachment", "Tank Aces", "Extra Regimental Doctrine", "Favour of the Dark Gods", "Exalted
 *   Abilities", "Blessings of the Faithful", "… Enhancements", "Boarding Action Enhancements", "War Zone …"); entries
 *   named "Warlord Trait: …", "WT: …", "Stratagem: …".
 * Not list-building, though the plan's first guess had them: "Vanguard Veterans" (a squad's own models) and "Chapter …"
 * groups other than relics and Chapter Command.
 *
 * A datasheet shows the unit's own wargear and abilities, plus the weapons of relic-type options flagged `extra` (spec
 * R2: "Also available"), which the sandbox can also match a chosen relic to. Their abilities, and everything under the
 * other options, are left to the info files (src/info): repeated on every character they doubled the Space Marine
 * catalogues past their 300 kB budget, and the engine reads a datasheet's abilities as the unit's own.
 */
const EXTRA_GROUP =
  /\brelics?\b|\bartefacts?\b|\bheirlooms?\b|\btreasures?\b|\btrophies\b|^chapter (relics|command)\b|^special[- ]issue\b|\barmy of renown\b|\bkustom jobs\b|\bgubbinz\b|\bsignature systems\b|^prototype\b|^gifts of\b/i;
const EXTRA_ENTRY = /^!?(relic\s*[:(]|heirloom\s*[:(]|chapter command:|army of renown)/i;
const OPTION_GROUP =
  /\btraits?\b|\bstratagems?\b|\brequisitions?\b|\bregimental doctrines?\b|^tank aces\b|\benhancements?\b|^specialist\b|^boarding action|^war zone|^favour of the dark gods|^visions of\b|^blessings of\b|^exalted (abilities|bloodthirster|great unclean one|keeper of secrets|lord of change)/i;
const OPTION_ENTRY = /^!?(warlord traits?\b|wt\s*[:(]|strat[ae]gem:)/i;

/** Whether a group, entry or link (with its target) has a name `group` (for groups) or `entry` matches. */
const named = (n: RawNode, target: RawNode, group: RegExp, entry: RegExp) =>
  [n.attrs.name, target.attrs.name].some((name) => (target.tag === 'selectionEntryGroup' ? group : entry).test((name ?? '').trim()));
/** A relic-type option: its weapons are listed as extras. */
const isExtra = (n: RawNode, target: RawNode) => named(n, target, EXTRA_GROUP, EXTRA_ENTRY);
/** Crusade content or one of the army's other options: never part of the datasheet. */
const isSkipped = (n: RawNode, target: RawNode) =>
  DROPPED.test(n.attrs.name ?? '') || DROPPED.test(target.attrs.name ?? '') || named(n, target, OPTION_GROUP, OPTION_ENTRY);

/** Forge World (Imperial Armour) catalogues; their internal names don't always say "FW". */
const FORGE_WORLD_CATALOGUES = new Set([
  'Imperium - Death Korps of Krieg',
  'Imperium - Elysian Drop Troops',
  'Imperium - FW Adeptus Astartes',
  'Chaos - FW Heretic Astartes',
  'Imperium - Titan Legions',
  'Chaos - Chaos Titan Legions',
]);
const isForgeWorldCatalogue = (c: RawCatalogue) => FORGE_WORLD_CATALOGUES.has(c.name) || c.name.includes('FW ');

/**
 * Selections every list the app builds has a known count of: the game type is always Matched, never Open Play or
 * Narrative, and the Boarding Patrol detachment is never offered. Everything else is an army choice.
 */
const KNOWN_COUNTS = new Map<string, number>([
  [MATCHED_GROUP, 1],
  ['cfc5-43e4-b02e-d1f9', 0], // Open (game type)
  ['c702-d73b-dccf-5617', 0], // Narrative (game type)
  [FORCE.boardingPatrol, 0],
]);

/** A condition's value in every list the app builds, or undefined when it depends on the army's choices. */
function known(c: Cond): boolean | undefined {
  const n = KNOWN_COUNTS.get(c.childId);
  if (n === undefined || (c.field !== 'selections' && c.field !== 'forces')) return undefined;
  switch (c.type) {
    case 'lessThan': return n < c.value;
    case 'greaterThan': return n > c.value;
    case 'equalTo': return n === c.value;
    case 'notEqualTo': return n !== c.value;
    case 'atLeast': return n >= c.value;
    case 'atMost': return n <= c.value;
    default: return undefined;
  }
}

/** A condition group's value in every list the app builds (an empty group holds), or undefined. */
function knownGroup(g: CondGroup): boolean | undefined {
  const values = [...g.conds.map(known), ...g.groups.map(knownGroup)];
  if (g.type === 'and') return values.some((v) => v === false) ? false : values.every((v) => v === true) ? true : undefined;
  return values.length === 0 || values.some((v) => v === true) ? true : values.every((v) => v === false) ? false : undefined;
}

/** Option prefixes that name a kind of army choice, read after the choice: "Sautekh dynasty", "Mars forge world". */
const KIND_HEADINGS = /^(dynasty|forge world|order|chapter|legion|sept|hive fleet|clan|kabal|wych cult|coven|household|shield host|league|plague company|great company|brotherhood|regiment|craftworld)$/i;

const isCount = (c: Cond) => c.field === 'selections' || c.field === 'forces';
/** "X is not in the list": a hide on it means the unit needs X. */
const absent = (c: Cond) => isCount(c) && ((c.type === 'lessThan' && c.value === 1) || (c.type === 'equalTo' && c.value === 0));
/** "X is in the list": a reveal on it means the unit needs X. */
const present = (c: Cond) => isCount(c) && ((c.type === 'atLeast' && c.value >= 1) || (c.type === 'greaterThan' && c.value === 0) || (c.type === 'equalTo' && c.value >= 1));

/**
 * Ways past a condition: alternatives, each the set of choices it needs together ([[]]: nothing; []: no way). `null`
 * when it holds only conditions of the other kind, an exclusion ("in an Annihilation Legion") or context ("a dynasty
 * is chosen"): those add no requirement, and a condition of nothing else is left out.
 */
type Ways = string[][] | null;
const NOTHING: string[][] = [[]];

/** Every one of `parts` at once: each combination of one way from each. */
function allOf(parts: Ways[]): Ways {
  const real = parts.filter((p): p is string[][] => p !== null);
  if (!real.length) return null;
  return real.reduce<string[][]>((acc, p) => acc.flatMap((a) => p.map((b) => [...new Set([...a, ...b])])), NOTHING);
}

/** Any one of `parts`. */
function anyOf(parts: Ways[]): Ways {
  const real = parts.filter((p): p is string[][] => p !== null);
  return real.length ? real.flat() : null;
}

/**
 * The choices that make `g` hold (a reveal, `want` true: its "X is in the list" conditions) or fail (a hide, `want`
 * false: its "X is not in the list" conditions, met by taking X).
 */
function ways(g: CondGroup, want: boolean): Ways {
  const value = knownGroup(g);
  if (value !== undefined) return value === want ? NOTHING : [];
  const kind = want ? present : absent;
  const leaf = (c: Cond): Ways => {
    const v = known(c);
    if (v !== undefined) return v === want ? NOTHING : [];
    return kind(c) ? [[c.childId]] : null;
  };
  const parts = [...g.conds.map(leaf), ...g.groups.map((x) => ways(x, want))];
  // Holding takes every part of an "and" and one of an "or"; failing, one part of an "and" and every part of an "or".
  return (g.type === 'and') === want ? allOf(parts) : anyOf(parts);
}

/** The alternatives without repeats or supersets of another; none at all when one of them needs nothing. */
function simplest(alternatives: string[][]): string[][] {
  const out: string[][] = [];
  for (const a of alternatives) {
    if (out.some((o) => o.every((id) => a.includes(id)))) continue;
    for (let i = out.length - 1; i >= 0; i--) if (a.every((id) => out[i].includes(id))) out.splice(i, 1);
    out.push(a);
  }
  return out.some((a) => !a.length) ? [] : out;
}

/**
 * Whether a root entry can be fielded in a matched play list, and what reveals it: alternatives, each the set of choices
 * it needs together. A hide whose condition holds in every list (an Open Play- or Narrative-only unit), or hidden by
 * default with nothing that can reveal it, leaves it off. A hide on "X is not in the list" (Imotekh without the Sautekh
 * dynasty) needs X; a hide on "X is in the list" (Imotekh in an Annihilation Legion) only rules the unit out. Every hide
 * must fail, and a unit hidden by default needs one of its reveals.
 */
const statNorm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
/** A name without its loadout: "Havoc w/ lascannon", "Storm Guardian - Aeldari Flamer", "Mutant with Autogun (x2)" → the model. */
const statBase = (s: string) =>
  statNorm(s)
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+-\s.*$/, '')
    .replace(/\s+(with|and|&)\s.*$/, '')
    .replace(/\s*(\/w|w\/).*$/, '')
    .trim();
const singular = (s: string) => s.replace(/ies$/, 'y').replace(/s$/, '');
const LEADER = /\b(sergeant|champion|nob|exarch|superior|leader|sword brother|acothyst|aspiring|boss|alpha|shas'ui|shas'vre|hekatrix|sybarite|kaptin|lieutenant)\b/;

/**
 * The unit stat line a model entry with none of its own uses, by the names BSData gives both (Plan H final review): the
 * same name, with or without its loadout or plural; a stat line named at the start or end of the model's name ("Assault
 * Terminator w/THSS" → "Terminator"); a leader by their title or a trooper by the word both names end with ("Devastator
 * Marine Sergeant" → "Space Marine Sergeant"); else the one stat line no other model of the unit uses. -1 when none.
 */
export function statLineByName(name: string, models: ProfileOut[], used: Set<number>): number {
  if (!models.length) return -1;
  const names = models.map((p) => statNorm(p.name));
  const base = names.map(statBase);
  const n = statNorm(name);
  const b = statBase(name);
  for (const c of [n, b, singular(b)]) {
    const i = names.indexOf(c);
    if (i >= 0) return i;
  }
  for (const c of [b, singular(b)]) {
    const i = base.findIndex((x) => x === c || singular(x) === c);
    if (i >= 0) return i;
  }
  const affix = (pred: (x: string) => boolean) =>
    base.map((x, i) => ({ x, i })).filter(({ x }) => x && pred(x)).sort((p, q) => q.x.length - p.x.length)[0]?.i;
  const inName = affix((x) => b.startsWith(x + ' ') || b.endsWith(' ' + x));
  if (inName !== undefined) return inName;
  const named = affix((x) => x.endsWith(' ' + b) || x.startsWith(b + ' '));
  if (named !== undefined) return named;
  const lead = LEADER.exec(b)?.[1];
  const hits = lead
    ? base.flatMap((x, i) => (x.includes(lead) ? [i] : []))
    : base.flatMap((x, i) => (!LEADER.test(x) && singular(x.split(' ').pop() ?? '') === singular(b.split(' ').pop() ?? '') ? [i] : []));
  if (hits.length === 1) return hits[0];
  const free = models.map((_, i) => i).filter((i) => !used.has(i));
  if (free.length === 1) return free[0];
  return models.length === 1 ? 0 : -1;
}

export function availability(mods: Mod[], hiddenByDefault: boolean): { fielded: boolean; needIdSets: string[][] } {
  const hides = mods.filter((m) => m.field === 'hidden' && m.value === 'true');
  const reveals = mods.filter((m) => m.field === 'hidden' && m.value === 'false' && (!m.when || knownGroup(m.when) !== false));
  if (!reveals.length && (hiddenByDefault || hides.some((m) => !m.when || knownGroup(m.when) === true))) return { fielded: false, needIdSets: [] };
  // A hide nothing can lift is left to the reveal that overrides it.
  const parts: Ways[] = hides.map((m) => (m.when ? ways(m.when, false) : null)).filter((p) => p === null || p.length > 0);
  if (hiddenByDefault) parts.push(anyOf(reveals.map((m) => (m.when ? (ways(m.when, true) ?? NOTHING) : NOTHING))));
  return { fielded: true, needIdSets: simplest(allOf(parts) ?? NOTHING) };
}

const child = (n: RawNode, tag: string) => n.children.find((c) => c.tag === tag);
const kids = (n: RawNode, tag: string) => child(n, tag)?.children ?? [];

/** Root entries a player can pick, with the catalogue each one comes from. */
function rootEntries(gd: GameData, cat: RawCatalogue, seen = new Set<string>()): { node: RawNode; source: RawCatalogue }[] {
  if (seen.has(cat.id)) return [];
  seen.add(cat.id);
  const own = [...kids(cat.root, 'entryLinks'), ...kids(cat.root, 'selectionEntries')].map((node) => ({ node, source: cat }));
  const imported = cat.links
    .filter((l) => l.importRootEntries)
    .flatMap((l) => {
      const linked = gd.catalogues.get(l.targetId);
      return linked ? rootEntries(gd, linked, seen) : [];
    });
  return [...own, ...imported];
}

function profileOut(p: RawNode): ProfileOut {
  const chars: Record<string, string> = {};
  for (const c of kids(p, 'characteristics')) chars[c.attrs.name] = c.text ?? '';
  return { name: p.attrs.name, chars };
}

function constraintValue(n: RawNode, type: 'min' | 'max'): number | null {
  const c = kids(n, 'constraints').find(
    (x) => x.attrs.type === type && x.attrs.field === 'selections' && x.attrs.scope === 'parent',
  );
  return c ? Number(c.attrs.value) : null;
}

export function extractUnits(gd: GameData, catalogueId: string): UnitOut[] {
  const cat = gd.catalogues.get(catalogueId);
  if (!cat) throw new Error(`Unknown catalogue ${catalogueId}`);
  const index = buildIdIndex(catalogueScope(gd, catalogueId));
  const resolve = (n: RawNode) => (n.tag === 'entryLink' ? index.get(n.attrs.targetId) : n);
  const categoryName = (link: RawNode) => index.get(link.attrs.targetId)?.attrs.name ?? link.attrs.name;
  const isModel = (n: RawNode) => resolve(n)?.attrs.type === 'model';

  /** [min, max] models contributed by an entry, group, or link. */
  function modelCount(n: RawNode): [number, number] | null {
    const target = resolve(n);
    if (!target) return null;
    if (n.tag === 'selectionEntryGroup') {
      const inner = innerCount(n);
      if (!inner) return null;
      return [constraintValue(n, 'min') ?? inner[0], constraintValue(n, 'max') ?? inner[1]];
    }
    if (isModel(n)) {
      const min = constraintValue(n, 'min') ?? constraintValue(target, 'min') ?? 0;
      const max = constraintValue(n, 'max') ?? constraintValue(target, 'max') ?? Math.max(min, 1);
      return [min, max];
    }
    // A squad inside the squad (the Cadian Command Squad's Veterans): its models, as many times as it is taken.
    if (target.attrs.type === 'unit' && n.tag !== 'selectionEntryGroup') {
      const inner = innerCount(target);
      if (!inner) return null;
      const min = constraintValue(n, 'min') ?? constraintValue(target, 'min') ?? 1;
      const max = constraintValue(n, 'max') ?? constraintValue(target, 'max') ?? Math.max(min, 1);
      return [inner[0] * min, inner[1] * max];
    }
    return null;
  }

  /** Crusade content and list-building extras never hold a unit's models. */
  const notModels = (c: RawNode) => {
    const t = resolve(c);
    return DROPPED.test(c.attrs.name ?? '') || (!!t && (isSkipped(c, t) || isExtra(c, t)));
  };

  function innerCount(n: RawNode): [number, number] | null {
    const parts = [...kids(n, 'selectionEntries'), ...kids(n, 'entryLinks'), ...kids(n, 'selectionEntryGroups')]
      .filter((c) => !notModels(c))
      .map(modelCount)
      .filter((x): x is [number, number] => x !== null);
    if (!parts.length) return null;
    return [parts.reduce((a, p) => a + p[0], 0), parts.reduce((a, p) => a + p[1], 0)];
  }

  /** A model entry's own stat line: a Unit profile on the entry, or one an info link on it points at. */
  const unitProfileName = (model: RawNode): string | undefined => {
    const own = kids(model, 'profiles').find((p) => (p.attrs.typeName ?? '').startsWith('Unit'));
    if (own) return own.attrs.name;
    for (const l of kids(model, 'infoLinks')) {
      const t = index.get(l.attrs.targetId);
      if (t?.tag === 'profile' && (t.attrs.typeName ?? '').startsWith('Unit')) return t.attrs.name;
    }
    return undefined;
  };

  /**
   * The unit's kinds of model (spec §3): each model entry with the ids that select it, its stat line and its limits; a
   * single-model unit is one kind. Default counts and `optional` are set by the build from the roster engine.
   */
  function kindsOf(root: RawNode, target: RawNode, models: ProfileOut[]): ModelKindOut[] {
    const profile = (m: RawNode) => {
      const name = unitProfileName(m);
      return name === undefined ? -1 : models.findIndex((p) => p.name === name);
    };
    const limit = (link: RawNode | null, m: RawNode, type: 'min' | 'max') =>
      (link && constraintValue(link, type)) ?? constraintValue(m, type);
    const single = (): ModelKindOut[] => [
      { entryIds: [...new Set([root.attrs.id, target.attrs.id])], name: target.attrs.name, profile: profile(target), defaultCount: 0, min: 1, max: 1, weapons: [], abilities: [] },
    ];
    if (target.attrs.type === 'model') return single();
    const found = modelEntries(target).map(({ link, model }) => ({
      entryIds: link ? [link.attrs.id, model.attrs.id] : [model.attrs.id],
      name: model.attrs.name,
      profile: profile(model),
      defaultCount: 0,
      min: limit(link, model, 'min') ?? 0,
      max: limit(link, model, 'max') ?? -1,
      weapons: [],
      abilities: [],
    }));
    // A model entry BSData gives no stat line of its own (the Tactical Squad's: "Space Marine" sits on the unit) takes
    // the unit's stat line its name names.
    const used = new Set(found.map((k) => k.profile).filter((i) => i >= 0));
    for (const k of found) if (k.profile < 0) k.profile = statLineByName(k.name, models, used);
    // A single model BattleScribe stores as an upgrade (Vashtorr, the Chaos Warlord Titan) is one kind too.
    return !found.length && target.attrs.type === 'upgrade' && profile(target) >= 0 ? single() : found;
  }

  /** The model entries inside a unit (not descending into models), with the link that reached each. */
  function modelEntries(unit: RawNode): { link: RawNode | null; model: RawNode }[] {
    const found: { link: RawNode | null; model: RawNode }[] = [];
    const seen = new Set<string>();
    const walk = (n: RawNode) => {
      for (const c of [...kids(n, 'selectionEntries'), ...kids(n, 'entryLinks'), ...kids(n, 'selectionEntryGroups')]) {
        if (c.attrs.hidden === 'true' || notModels(c)) continue;
        const t = resolve(c);
        if (!t || t.attrs.hidden === 'true' || seen.has(t.attrs.id)) continue;
        seen.add(t.attrs.id);
        if (t.attrs.type === 'model') found.push({ link: c.tag === 'entryLink' ? c : null, model: t });
        else walk(t);
      }
    };
    walk(unit);
    return found;
  }

  function collect(entry: RawNode) {
    const models: ProfileOut[] = [];
    const weapons: ProfileOut[] = [];
    const abilities: AbilityOut[] = [];
    const psychic: ProfileOut[] = [];
    const woundTrack: ProfileOut[] = [];
    let transport: ProfileOut | null = null;
    // A node is walked once as the unit's own and once more at most as an extra (own wargear wins).
    const visited = { own: new Set<string>(), extra: new Set<string>() };
    /** By entry id (link and target): the names of what that entry itself brings, made indexes at the end. */
    type Rec = { w: Set<string>; a: Set<string>; p: Set<string>; m?: string };
    const recs = new Map<string, Rec>();
    const recFor = (ids: string[]): Rec => {
      const r = ids.map((id) => recs.get(id)).find(Boolean) ?? { w: new Set<string>(), a: new Set<string>(), p: new Set<string>() };
      for (const id of ids) recs.set(id, r);
      return r;
    };
    /** Adds by name; the unit's own item replaces an extra of the same name. */
    const pushUnique = <T extends { name: string; extra?: true }>(list: T[], item: T) => {
      const i = list.findIndex((x) => x.name === item.name);
      if (i < 0) list.push(item);
      else if (list[i].extra && !item.extra) list[i] = item;
    };
    const flag = (extra: boolean) => (extra ? { extra: true as const } : {});

    const addProfile = (p: RawNode, extra: boolean, rec: Rec) => {
      const out = profileOut(p);
      const typeName = p.attrs.typeName ?? '';
      // An extra shows only its weapons: its statline, abilities, psychic powers and the rest are not the unit's.
      if (extra && typeName !== 'Weapon') return;
      if (typeName.startsWith('Unit')) {
        rec.m ??= out.name;
        return pushUnique(models, out);
      }
      if (/wound track|^stat damage/i.test(typeName)) return pushUnique(woundTrack, out);
      switch (typeName) {
        case 'Weapon':
          rec.w.add(out.name);
          pushUnique(weapons, { ...out, ...flag(extra) });
          break;
        case 'Abilities':
          rec.a.add(out.name);
          pushUnique(abilities, { name: out.name, text: out.chars.Description ?? '', source: 'bsdata' });
          break;
        case 'Psyker':
        case 'Psychic Power':
          rec.p.add(out.name);
          pushUnique(psychic, out);
          break;
        case 'Transport':
          transport = out;
          break;
      }
    };
    const addRule = (r: RawNode, extra: boolean, rec: Rec) => {
      if (extra) return;
      rec.a.add(r.attrs.name);
      pushUnique(abilities, { name: r.attrs.name, text: child(r, 'description')?.text ?? '', source: 'bsdata' });
    };

    /** `rec` collects what this entry itself brings; an info group's contents count as the entry's own. */
    const walk = (n: RawNode, extra: boolean, rec: Rec) => {
      const key = n.attrs.id;
      if (key) {
        if (visited.own.has(key) || (extra && visited.extra.has(key))) return;
        visited[extra ? 'extra' : 'own'].add(key);
      }
      kids(n, 'profiles').forEach((p) => addProfile(p, extra, rec));
      kids(n, 'rules').forEach((r) => addRule(r, extra, rec));
      for (const link of kids(n, 'infoLinks')) {
        const target = index.get(link.attrs.targetId);
        if (!target) continue;
        const hiddenUnitProfile = target.tag === 'profile' && (target.attrs.typeName ?? '').startsWith('Unit');
        if (link.attrs.hidden === 'true' && !hiddenUnitProfile) continue;
        if (target.tag === 'profile') addProfile(target, extra, rec);
        else if (target.tag === 'rule') addRule(target, extra, rec);
        else walk(target, extra, rec);
      }
      for (const c of [...kids(n, 'selectionEntries'), ...kids(n, 'selectionEntryGroups'), ...kids(n, 'entryLinks')]) {
        if (c.attrs.hidden === 'true') continue;
        const target = c.tag === 'entryLink' ? index.get(c.attrs.targetId) : c;
        if (!target || target.attrs.hidden === 'true' || isSkipped(c, target)) continue;
        // Keyed by the target only: a roster selection reaches it through merged.target.id whichever link it took.
        walk(target, extra || isExtra(c, target), recFor([target.attrs.id]));
      }
    };
    walk(entry, false, recFor([entry.attrs.id]));
    const at = <T extends { name: string }>(list: T[], names: Set<string>) =>
      [...names].map((nm) => list.findIndex((x) => x.name === nm)).filter((i) => i >= 0);
    const entries: Record<string, EntryGear> = {};
    for (const [id, r] of recs) {
      const g: EntryGear = {};
      const w = at(weapons, r.w);
      const a = at(abilities, r.a);
      const p = at(psychic, r.p);
      if (w.length) g.w = w;
      if (a.length) g.a = a;
      if (p.length) g.p = p;
      if (r.m !== undefined && models.findIndex((x) => x.name === r.m) >= 0) g.m = models.findIndex((x) => x.name === r.m);
      if (Object.keys(g).length) entries[id] = g;
    }
    return { models, weapons, abilities, psychic, woundTrack, transport: transport as ProfileOut | null, entries };
  }

  /** Whether a unit- or model-typed entry is anywhere below the entry (a No Force Org Slot wrapper, not a unit). */
  const holdsUnit = (n: RawNode, seen: Set<string>): boolean =>
    [...kids(n, 'selectionEntries'), ...kids(n, 'selectionEntryGroups'), ...kids(n, 'entryLinks')].some((c) => {
      const t = resolve(c);
      if (!t) return false;
      if (t.attrs.type === 'unit' || t.attrs.type === 'model') return true;
      if (seen.has(t.attrs.id)) return false;
      seen.add(t.attrs.id);
      return holdsUnit(t, seen);
    });
  /**
   * The option or unit a condition names, as a player reads it: "Blood Ravens", "Sautekh dynasty" (a kind of choice
   * after its name), "Destroyer Cult" (a faction alone), "Ynnari: Strength From Death" (any other prefix kept in front).
   */
  const needName = (id: string) => {
    const { name, heading } = optionDisplay(index.get(id)?.attrs.name ?? id);
    if (!heading || heading === 'Faction' || name.toLowerCase().endsWith(heading.toLowerCase())) return name;
    return KIND_HEADINGS.test(heading) ? `${name} ${heading.toLowerCase()}` : `${heading}: ${name}`;
  };

  const units: UnitOut[] = [];
  const byId = new Map<string, UnitOut>();
  for (const { node: root, source } of rootEntries(gd, cat)) {
    const target = resolve(root);
    if (!target) continue;
    const name = target.attrs.name;
    const type = target.attrs.type;
    if (DROPPED.test(name)) continue;

    const catLinks = [...kids(root, 'categoryLinks'), ...(root === target ? [] : kids(target, 'categoryLinks'))];
    const primary = catLinks.find((l) => l.attrs.primary === 'true');
    const primaryName = primary ? categoryName(primary) : null;
    if (!isUnitLike(type, primaryName, name) || name.startsWith('[')) continue;
    if (type === 'upgrade' && !BATTLEFIELD_ROLES.includes(primaryName as BattlefieldRole) && holdsUnit(target, new Set([target.attrs.id]))) continue;
    const hiddenByDefault = root.attrs.hidden === 'true' || target.attrs.hidden === 'true';
    const { fielded, needIdSets } = availability([...modifiersOf(root), ...(root === target ? [] : modifiersOf(target))], hiddenByDefault);
    if (!fielded) continue;
    const needs = [...new Set(needIdSets.map((ids) => [...new Set(ids.map(needName))].join(' and ')))];
    const seen = byId.get(target.attrs.id);
    if (seen) {
      // Listed twice (a link per detachment type, say): it needs a choice only if every listing does.
      if (seen.needs && !needs.length) delete seen.needs;
      continue;
    }

    const role: BattlefieldRole | null = BATTLEFIELD_ROLES.find((r) => r === primaryName) ?? null;
    const keywords: string[] = [];
    const factionKeywords: string[] = [];
    const addKeywords = (links: RawNode[], into: string[]) => {
      for (const l of links) {
        if (l === primary) continue;
        const kw = categoryName(l);
        if (!kw) continue;
        if (kw.startsWith('Faction: ')) {
          if (!factionKeywords.includes(kw.slice(9))) factionKeywords.push(kw.slice(9));
        } else if (!into.includes(kw)) into.push(kw);
      }
    };
    addKeywords(catLinks, keywords);

    // Multi-model units (squadrons, crewed guns) often hold keywords on the model entries only.
    // The unit has every keyword its models have; each model keeps its own set for model-level rules.
    const perModel = modelEntries(target).map(({ link, model }) => {
      const own = [...keywords];
      addKeywords([...(link ? kids(link, 'categoryLinks') : []), ...kids(model, 'categoryLinks')], own);
      return { model: model.attrs.name, keywords: own };
    });
    for (const m of perModel) m.keywords.forEach((kw) => !keywords.includes(kw) && keywords.push(kw));
    const distinctSets = new Set(perModel.map((m) => [...m.keywords].sort().join('|')));
    const modelKeywords = distinctSets.size > 1 ? perModel : undefined;

    const counts = type === 'model' ? ([1, 1] as [number, number]) : innerCount(target);
    const collected = collect(target);
    const modelKinds = kindsOf(root, target, collected.models);
    const pl = kids(target, 'costs').find((c) => c.attrs.name?.trim() === 'PL');
    const publication = target.attrs.publicationId ? (index.get(target.attrs.publicationId)?.attrs.name ?? '') : '';

    units.push({
      id: target.attrs.id,
      slug: slugify(name),
      name,
      catalogueId,
      role,
      keywords,
      factionKeywords,
      ...(modelKeywords ? { modelKeywords } : {}),
      ...collected,
      ...(modelKinds.length && { modelKinds }),
      minModels: counts ? counts[0] : null,
      maxModels: counts ? counts[1] : null,
      powerLevel: pl ? Number(pl.attrs.value) : null,
      points: null,
      baseSize: null,
      wahapediaId: null,
      legends: /\[legends\]/i.test(name),
      forgeWorld: isForgeWorldCatalogue(cat) || isForgeWorldCatalogue(source) || /imperial armour/i.test(publication),
      ...(needs.length && { needs }),
    });
    byId.set(target.attrs.id, units[units.length - 1]);
  }
  return units;
}
