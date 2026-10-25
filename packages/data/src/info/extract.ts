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

/**
 * Option id -> the profiles, rules, infoGroups and infoLinks its selection reveals: those a `set hidden true` modifier
 * hides while the option isn't chosen (any condition of the modifier, groups included). A relic marker with no text of
 * its own keeps it here: The Diamonas shows a Weapon profile on the laser destructor it replaces.
 */
function revealIndex(scope: RawCatalogue[]): Map<string, RawNode[]> {
  const out = new Map<string, RawNode[]>();
  const optionIds = (n: RawNode, acc: Set<string>): Set<string> => {
    if (notChosen(n) && n.attrs.childId) acc.add(n.attrs.childId);
    n.children.forEach((c) => optionIds(c, acc));
    return acc;
  };
  const walk = (n: RawNode) => {
    if (REVEALABLE.has(n.tag)) {
      for (const m of kids(n, 'modifiers')) {
        if (m.attrs.type !== 'set' || m.attrs.field !== 'hidden' || m.attrs.value !== 'true') continue;
        for (const id of optionIds(m, new Set())) {
          const list = out.get(id) ?? [];
          if (!list.includes(n)) list.push(n);
          out.set(id, list);
        }
      }
    }
    n.children.forEach(walk);
  };
  scope.forEach((c) => walk(c.root));
  return out;
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
    if (!profiles.length && !rules.length) revealed.forEach(take);
    return { ...(profiles.length ? { profiles } : {}), ...(rules.length ? { rules } : {}) };
  };

  /**
   * What an option's selection reveals: an entry's, from anywhere in scope; a link's, only when its target is defined in
   * another file and has no text there, and only what this file reveals (the target's own file attaches the rest).
   */
  const revealedFor = (n: RawNode): RawNode[] => {
    if (n.tag !== 'entryLink') return reveals.get(n.attrs.id) ?? [];
    const target = index.get(n.attrs.targetId);
    if (!target || ownIds.has(n.attrs.targetId)) return [];
    const own = infoOf(target);
    if (own.profiles || own.rules) return [];
    return (reveals.get(n.attrs.targetId) ?? []).filter((r) => ownIds.has(r.attrs.id));
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
