import { buildIdIndex, catalogueScope } from '../bsdata/gamedata';
import type { GameData, RawCatalogue, RawNode } from '../bsdata/types';
import { BATTLEFIELD_ROLES, type AbilityOut, type BattlefieldRole, type ProfileOut, type UnitOut } from '../model/types';
import { slugify } from '../text';

/** Crusade content, never part of a datasheet: skipped wherever it is (the roster files drop it too). */
const DROPPED = /^(battle honours|battle scars|crusade|agendas)\b/i;

/**
 * List-building extras: a weapon or ability found under one of these (a group, or an entry or link, anywhere between
 * the unit and the profile) is flagged `extra`, not the unit's own wargear. The rule is on the enclosing groups and
 * entries, never the weapon's own name: "Relic Gauss Blaster" is the Royal Warden's own weapon, "Relic blade" an Honour
 * Guard's, and "Relic Terminator Squad" a unit.
 *
 * Evidence (the group and entry names on the path to every weapon and ability in Necrons, Ultramarines, Orks, Astra
 * Militarum and Chaos Space Marines, then every group name in every catalogue, 2026-10-24):
 * - relics live in groups named "Relics", "Chapter Relics", "Relics of Macragge", "Sacred Relics of the Cult",
 *   "Artefacts of the Aeons", "Bio-artefacts", "Heirlooms of Conquest", "Corrupted Heirloom", "Treasures of the
 *   Aeldari", "Trophies of the Long War", "Relic Bearers", "Shiny Gubbinz", "Signature Systems", "Prototype Systems",
 *   "Gifts of the Prescient";
 * - Warlord traits in "Warlord Traits (…)", "Codex Traits", "Shield Host Trait", "Visions of the Augurium";
 * - stratagem and requisition upgrades in "Stratagems", "Character Stratagems", "Specialist Mobs", "Specialist
 *   Detachment", "Tank Aces", "Vehicle Kustom Jobs", "Extra Regimental Doctrine", "Favour of the Dark Gods", "Exalted
 *   Abilities", "Blessings of the Faithful", "Special-Issue Wargear" / "Special Issue - …", "… Enhancements",
 *   "Boarding Action Enhancements", "War Zone …";
 * - and in entries named "Relic: …", "Relic (Sautekh): …", "Warlord Trait: …", "Stratagem: …", "Chapter Command: …".
 * Not extras, though the plan's first guess had them: "Vanguard Veterans" (a squad's own models) and "Chapter …"
 * groups other than relics and Chapter Command.
 */
const EXTRA_GROUP =
  /\brelics?\b|\bartefacts?\b|\bheirlooms?\b|\btreasures?\b|\btrophies\b|\btraits?\b|\bstratagems?\b|^chapter (relics|command)\b|^special[- ]issue\b|\barmy of renown\b|\brequisitions?\b|\bregimental doctrines?\b|^tank aces\b|\bkustom jobs\b|\bgubbinz\b|\benhancements?\b|^specialist\b|^boarding action|^war zone|\bsignature systems\b|^prototype\b|^favour of the dark gods|^gifts of\b|^visions of\b|^blessings of\b|^exalted (abilities|bloodthirster|great unclean one|keeper of secrets|lord of change)/i;
const EXTRA_ENTRY = /^!?(relic\s*[:(]|heirloom\s*[:(]|warlord traits?\b|wt\s*[:(]|strat[ae]gem:|chapter command:|army of renown)/i;

/** A group, entry or link (with its target) that holds list-building extras. */
const isExtra = (n: RawNode, target: RawNode) =>
  [n.attrs.name, target.attrs.name].some((name) => (target.tag === 'selectionEntryGroup' ? EXTRA_GROUP : EXTRA_ENTRY).test((name ?? '').trim()));

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
    return null;
  }

  /** Crusade content and list-building extras never hold a unit's models. */
  const notModels = (c: RawNode) => {
    const t = resolve(c);
    return DROPPED.test(c.attrs.name ?? '') || (!!t && (DROPPED.test(t.attrs.name ?? '') || isExtra(c, t)));
  };

  function innerCount(n: RawNode): [number, number] | null {
    const parts = [...kids(n, 'selectionEntries'), ...kids(n, 'entryLinks'), ...kids(n, 'selectionEntryGroups')]
      .filter((c) => !notModels(c))
      .map(modelCount)
      .filter((x): x is [number, number] => x !== null);
    if (!parts.length) return null;
    return [parts.reduce((a, p) => a + p[0], 0), parts.reduce((a, p) => a + p[1], 0)];
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
    /** Adds by name; the unit's own item replaces an extra of the same name. */
    const pushUnique = <T extends { name: string; extra?: true }>(list: T[], item: T) => {
      const i = list.findIndex((x) => x.name === item.name);
      if (i < 0) list.push(item);
      else if (list[i].extra && !item.extra) list[i] = item;
    };
    const flag = (extra: boolean) => (extra ? { extra: true as const } : {});

    const addProfile = (p: RawNode, extra: boolean) => {
      const out = profileOut(p);
      const typeName = p.attrs.typeName ?? '';
      // An extra's statline, wound track or transport capacity is not the unit's.
      if (typeName.startsWith('Unit')) return extra ? undefined : pushUnique(models, out);
      if (/wound track|^stat damage/i.test(typeName)) return extra ? undefined : pushUnique(woundTrack, out);
      switch (typeName) {
        case 'Weapon':
          pushUnique(weapons, { ...out, ...flag(extra) });
          break;
        case 'Abilities':
          pushUnique(abilities, { name: out.name, text: out.chars.Description ?? '', source: 'bsdata', ...flag(extra) });
          break;
        case 'Psyker':
        case 'Psychic Power':
          pushUnique(psychic, { ...out, ...flag(extra) });
          break;
        case 'Transport':
          if (!extra) transport = out;
          break;
      }
    };
    const addRule = (r: RawNode, extra: boolean) =>
      pushUnique(abilities, { name: r.attrs.name, text: child(r, 'description')?.text ?? '', source: 'bsdata', ...flag(extra) });

    const walk = (n: RawNode, extra: boolean) => {
      const key = n.attrs.id;
      if (key) {
        if (visited.own.has(key) || (extra && visited.extra.has(key))) return;
        visited[extra ? 'extra' : 'own'].add(key);
      }
      kids(n, 'profiles').forEach((p) => addProfile(p, extra));
      kids(n, 'rules').forEach((r) => addRule(r, extra));
      for (const link of kids(n, 'infoLinks')) {
        const target = index.get(link.attrs.targetId);
        if (!target) continue;
        const hiddenUnitProfile = target.tag === 'profile' && (target.attrs.typeName ?? '').startsWith('Unit');
        if (link.attrs.hidden === 'true' && !hiddenUnitProfile) continue;
        if (target.tag === 'profile') addProfile(target, extra);
        else if (target.tag === 'rule') addRule(target, extra);
        else walk(target, extra);
      }
      for (const c of [...kids(n, 'selectionEntries'), ...kids(n, 'selectionEntryGroups'), ...kids(n, 'entryLinks')]) {
        if (c.attrs.hidden === 'true' || DROPPED.test(c.attrs.name ?? '')) continue;
        const target = c.tag === 'entryLink' ? index.get(c.attrs.targetId) : c;
        if (!target || target.attrs.hidden === 'true' || DROPPED.test(target.attrs.name ?? '')) continue;
        walk(target, extra || isExtra(c, target));
      }
    };
    walk(entry, false);
    return { models, weapons, abilities, psychic, woundTrack, transport: transport as ProfileOut | null };
  }

  const units: UnitOut[] = [];
  const seenIds = new Set<string>();
  for (const { node: root, source } of rootEntries(gd, cat)) {
    const target = resolve(root);
    if (!target) continue;
    const name = target.attrs.name;
    const type = target.attrs.type;
    if ((type !== 'unit' && type !== 'model') || name.startsWith('[')) continue;
    if (root.attrs.hidden === 'true' || target.attrs.hidden === 'true' || DROPPED.test(name)) continue;
    if (seenIds.has(target.attrs.id)) continue;
    seenIds.add(target.attrs.id);

    const catLinks = [...kids(root, 'categoryLinks'), ...(root === target ? [] : kids(target, 'categoryLinks'))];
    const primary = catLinks.find((l) => l.attrs.primary === 'true');
    const primaryName = primary ? categoryName(primary) : null;
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
      ...collect(target),
      minModels: counts ? counts[0] : null,
      maxModels: counts ? counts[1] : null,
      powerLevel: pl ? Number(pl.attrs.value) : null,
      points: null,
      baseSize: null,
      wahapediaId: null,
      legends: /\[legends\]/i.test(name),
      forgeWorld: isForgeWorldCatalogue(cat) || isForgeWorldCatalogue(source) || /imperial armour/i.test(publication),
    });
  }
  return units;
}
