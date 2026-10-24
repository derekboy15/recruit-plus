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

/**
 * The info of every `upgrade` entry, selection entry group and entry link in `file` that carries any: its own profiles
 * and rules plus those its infoLinks (profile, rule or infoGroup) and infoGroups reach, resolved across the file's
 * scope. Units, models and links to them are left out but walked into; hidden status is ignored (the roster engine
 * decides what shows). A link holds only its own info: its target's is under the target's id. Characteristics without
 * text, profiles with none, and rules without text are dropped, and so is everything the roster files drop (Crusade).
 */
export function emitInfoFile(gd: GameData, file: RawCatalogue, slug: string): InfoFile {
  const index = buildIdIndex(catalogueScope(gd, file.id));
  const isUnitOrModel = (n: RawNode) => {
    const t = n.tag === 'entryLink' ? index.get(n.attrs.targetId) : n;
    return t?.tag === 'selectionEntry' && (t.attrs.type === 'unit' || t.attrs.type === 'model');
  };

  const infoOf = (n: RawNode): EntryInfo => {
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
    addInfo(n);
    return { ...(profiles.length ? { profiles } : {}), ...(rules.length ? { rules } : {}) };
  };

  const entries: Record<string, EntryInfo> = {};
  const walk = (n: RawNode) => {
    if (DROPPED_NAME.test(n.attrs.name ?? '')) return;
    if (OPTION_TAGS.has(n.tag) && !isUnitOrModel(n) && !(n.attrs.id in entries)) {
      const info = infoOf(n);
      if (info.profiles || info.rules) entries[n.attrs.id] = info;
    }
    for (const tag of CHILD_TAGS) kids(n, tag).forEach(walk);
  };
  for (const tag of TOP_TAGS) kids(file.root, tag).forEach(walk);
  return { schema: 1, slug, entries };
}
