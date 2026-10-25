/** Info files: the profiles and rules of every army-building option in a BattleScribe file (spec §4, Plan D). */
import { buildIdIndex, catalogueScope } from '../bsdata/gamedata';
import type { GameData, RawCatalogue, RawNode } from '../bsdata/types';
import type { EntryInfo, InfoFile, InfoProfile, InfoRule } from '../model/types';
import { DROPPED_NAME } from '../roster/emit';

const child = (n: RawNode, tag: string) => n.children.find((c) => c.tag === tag);
const kids = (n: RawNode, tag: string) => child(n, tag)?.children ?? [];

const OPTION_TAGS = new Set(['selectionEntry', 'selectionEntryGroup', 'entryLink']);
const CHILD_TAGS = ['selectionEntries', 'selectionEntryGroups', 'entryLinks'];
const TOP_TAGS = ['selectionEntries', 'entryLinks', 'sharedSelectionEntries', 'sharedSelectionEntryGroups'];
const REVEALABLE = new Set(['profile', 'rule', 'infoGroup', 'infoLink']);

/** "While this option isn't chosen": a selections condition of 0 (equalTo 0, or lessThan 1) on its id. */
const notChosen = (c: RawNode) =>
  c.tag === 'condition' &&
  c.attrs.field === 'selections' &&
  ((c.attrs.type === 'equalTo' && Number(c.attrs.value) === 0) || (c.attrs.type === 'lessThan' && Number(c.attrs.value) === 1));

const isUnitEntry = (n: RawNode) => n.tag === 'selectionEntry' && (n.attrs.type === 'unit' || n.attrs.type === 'model');
const push = (m: Map<string, RawNode[]>, id: string, n: RawNode) => {
  const list = m.get(id) ?? [];
  if (!list.includes(n)) list.push(n);
  m.set(id, list);
};

/**
 * What each option's selection reveals: the profiles, rules, infoGroups and infoLinks a `set hidden true` modifier hides
 * while the option isn't chosen (any condition of the modifier, groups included). A relic marker with no text of its own
 * keeps it here: The Diamonas shows a Weapon profile on the laser destructor it replaces.
 * - `byOption`: by the option id the condition names (an entry's, or a link's).
 * - `byLink`: a node inside a unit that links the option itself belongs to that link, not to the option every unit shares:
 *   Imotekh's Grand Strategist is revealed by his own Warlord link, and no other Necron's Warlord option gives it.
 */
function revealIndex(scope: RawCatalogue[]): { byOption: Map<string, RawNode[]>; byLink: Map<string, RawNode[]> } {
  // Unit id -> option id -> the unit's own links to it (inline groups included, linked groups not followed).
  const unitLinks = new Map<string, Map<string, string[]>>();
  const collectLinks = (unit: RawNode) => {
    const links = new Map<string, string[]>();
    const walk = (n: RawNode) => {
      if (n.tag === 'entryLink') links.set(n.attrs.targetId, [...(links.get(n.attrs.targetId) ?? []), n.attrs.id]);
      for (const tag of CHILD_TAGS) kids(n, tag).forEach(walk);
    };
    for (const tag of CHILD_TAGS) kids(unit, tag).forEach(walk);
    unitLinks.set(unit.attrs.id, links);
  };
  const optionIds = (n: RawNode, acc: Set<string>): Set<string> => {
    if (notChosen(n) && n.attrs.childId) acc.add(n.attrs.childId);
    n.children.forEach((c) => optionIds(c, acc));
    return acc;
  };
  const found: { node: RawNode; option: string; unit: string | null }[] = [];
  const walk = (n: RawNode, unit: string | null) => {
    if (isUnitEntry(n)) {
      collectLinks(n);
      unit = n.attrs.id;
    }
    if (REVEALABLE.has(n.tag)) {
      for (const m of kids(n, 'modifiers')) {
        if (m.attrs.type !== 'set' || m.attrs.field !== 'hidden' || m.attrs.value !== 'true') continue;
        for (const option of optionIds(m, new Set())) found.push({ node: n, option, unit });
      }
    }
    n.children.forEach((c) => walk(c, unit));
  };
  scope.forEach((c) => walk(c.root, null));
  const byOption = new Map<string, RawNode[]>();
  const byLink = new Map<string, RawNode[]>();
  for (const { node, option, unit } of found) {
    const links = unit ? unitLinks.get(unit)?.get(option) : undefined;
    if (links?.length) links.forEach((l) => push(byLink, l, node));
    else push(byOption, option, node);
  }
  return { byOption, byLink };
}

/**
 * The info of every `upgrade` entry, selection entry group and entry link in `file` that carries any: its own profiles
 * and rules plus those its infoLinks (profile, rule or infoGroup) and infoGroups reach, resolved across the file's
 * scope. Units, models and links to them are left out but walked into; hidden status is ignored (the roster engine
 * decides what shows). A link holds only its own info: its target's is under the target's id. Characteristics without
 * text, profiles with none, and rules without text are dropped, and so is everything the roster files drop (Crusade).
 * An option with no text of its own takes what its selection reveals (revealIndex), from the scope of the file that
 * defines it; a link to such an option in another file takes what this file's scope reveals for it, under the link.
 */
export function emitInfoFile(gd: GameData, file: RawCatalogue, slug: string): InfoFile {
  const scope = catalogueScope(gd, file.id);
  const index = buildIdIndex(scope);
  const reveals = revealIndex(scope);
  const ownIds = new Set<string>();
  const collectIds = (n: RawNode) => {
    if (n.attrs.id) ownIds.add(n.attrs.id);
    n.children.forEach(collectIds);
  };
  collectIds(file.root);
  const isUnitOrModel = (n: RawNode) => {
    const t = n.tag === 'entryLink' ? index.get(n.attrs.targetId) : n;
    return t?.tag === 'selectionEntry' && (t.attrs.type === 'unit' || t.attrs.type === 'model');
  };

  /** `revealed` (revealIndex) is used only when the option has no text of its own. */
  const infoOf = (n: RawNode, revealed: RawNode[] = []): EntryInfo => {
    const profiles: InfoProfile[] = [];
    const rules: InfoRule[] = [];
    const seen = new Set<string>();
    const once = (x: RawNode) => {
      const id = x.attrs.id;
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    };
    const addProfile = (p: RawNode) => {
      if (!once(p)) return;
      const chars: Record<string, string> = {};
      for (const c of kids(p, 'characteristics')) if (c.text?.trim()) chars[c.attrs.name] = c.text;
      if (Object.keys(chars).length) profiles.push({ name: p.attrs.name, type: p.attrs.typeName ?? '', chars });
    };
    const addRule = (r: RawNode) => {
      if (!once(r)) return;
      const text = child(r, 'description')?.text ?? '';
      if (text.trim()) rules.push({ name: r.attrs.name, text });
    };
    const addInfo = (holder: RawNode) => {
      kids(holder, 'profiles').forEach(addProfile);
      kids(holder, 'rules').forEach(addRule);
      for (const g of kids(holder, 'infoGroups')) if (once(g)) addInfo(g);
      for (const link of kids(holder, 'infoLinks')) {
        const t = index.get(link.attrs.targetId);
        if (t?.tag === 'profile') addProfile(t);
        else if (t?.tag === 'rule') addRule(t);
        else if (t?.tag === 'infoGroup' && once(t)) addInfo(t);
      }
    };
    const take = (x: RawNode | undefined) => {
      if (x?.tag === 'profile') addProfile(x);
      else if (x?.tag === 'rule') addRule(x);
      else if (x?.tag === 'infoGroup' && once(x)) addInfo(x);
      else if (x?.tag === 'infoLink') take(index.get(x.attrs.targetId));
    };
    addInfo(n);
    if (!profiles.length && !rules.length && revealed.length) {
      revealed.forEach(take);
      // The builder's one-line summary is the first text: a rule or profile named like the option ("Army of Renown -
      // Speed Freeks Speed Mob" -> "Speed Freeks Speed Mob") leads, then abilities before other kinds of profile.
      const option = (n.attrs.name ?? '').toLowerCase();
      const named = (x: { name: string }) => (option.includes(x.name.toLowerCase()) ? 0 : 1);
      rules.sort((a, b) => named(a) - named(b));
      profiles.sort((a, b) => named(a) - named(b) || Number(a.type !== 'Abilities') - Number(b.type !== 'Abilities'));
    }
    return { ...(profiles.length ? { profiles } : {}), ...(rules.length ? { rules } : {}) };
  };

  /**
   * What an option's selection reveals. An entry: what conditions on its id reveal. A link whose target has no text:
   * what is revealed for this link itself (a unit's own link, or a condition naming the link's id), plus, when the target
   * is defined in another file, what this file reveals for the target (that file attaches the rest under the target).
   */
  const revealedFor = (n: RawNode): RawNode[] => {
    if (n.tag !== 'entryLink') return reveals.byOption.get(n.attrs.id) ?? [];
    const target = index.get(n.attrs.targetId);
    if (!target) return [];
    const own = infoOf(target);
    if (own.profiles || own.rules) return [];
    const forTarget = ownIds.has(n.attrs.targetId) ? [] : (reveals.byOption.get(n.attrs.targetId) ?? []).filter((r) => ownIds.has(r.attrs.id));
    return [...new Set([...(reveals.byLink.get(n.attrs.id) ?? []), ...(reveals.byOption.get(n.attrs.id) ?? []), ...forTarget])];
  };

  const entries: Record<string, EntryInfo> = {};
  const walk = (n: RawNode) => {
    if (DROPPED_NAME.test(n.attrs.name ?? '')) return;
    if (OPTION_TAGS.has(n.tag) && !isUnitOrModel(n) && !(n.attrs.id in entries)) {
      const info = infoOf(n, revealedFor(n));
      if (info.profiles || info.rules) entries[n.attrs.id] = info;
    }
    for (const tag of CHILD_TAGS) kids(n, tag).forEach(walk);
  };
  for (const tag of TOP_TAGS) kids(file.root, tag).forEach(walk);
  return { schema: 1, slug, entries };
}
