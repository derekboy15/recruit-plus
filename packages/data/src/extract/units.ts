import { buildIdIndex, catalogueScope } from '../bsdata/gamedata';
import type { GameData, RawCatalogue, RawNode } from '../bsdata/types';
import { BATTLEFIELD_ROLES, type AbilityOut, type BattlefieldRole, type ProfileOut, type UnitOut } from '../model/types';
import { slugify } from '../text';

/** Option groups that are list-building extras, not part of the datasheet itself. */
const SKIP_GROUP = /^(battle honours|battle scars|crusade|relics?|warlord traits?|stratagems?|agendas|specialist|enhancements?)\b/i;

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

  function innerCount(n: RawNode): [number, number] | null {
    const parts = [...kids(n, 'selectionEntries'), ...kids(n, 'entryLinks'), ...kids(n, 'selectionEntryGroups')]
      .filter((c) => !SKIP_GROUP.test(c.attrs.name ?? ''))
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
        if (c.attrs.hidden === 'true' || SKIP_GROUP.test(c.attrs.name ?? '')) continue;
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
    const visited = new Set<string>();
    const pushUnique = <T extends { name: string }>(list: T[], item: T) => {
      if (!list.some((x) => x.name === item.name)) list.push(item);
    };

    const addProfile = (p: RawNode) => {
      const out = profileOut(p);
      const typeName = p.attrs.typeName ?? '';
      if (typeName.startsWith('Unit')) return pushUnique(models, out);
      if (/wound track|^stat damage/i.test(typeName)) return pushUnique(woundTrack, out);
      switch (typeName) {
        case 'Weapon':
          pushUnique(weapons, out);
          break;
        case 'Abilities':
          pushUnique(abilities, { name: out.name, text: out.chars.Description ?? '', source: 'bsdata' });
          break;
        case 'Psyker':
        case 'Psychic Power':
          pushUnique(psychic, out);
          break;
        case 'Transport':
          transport = out;
          break;
      }
    };
    const addRule = (r: RawNode) =>
      pushUnique(abilities, { name: r.attrs.name, text: child(r, 'description')?.text ?? '', source: 'bsdata' });

    const walk = (n: RawNode) => {
      const key = n.attrs.id;
      if (key) {
        if (visited.has(key)) return;
        visited.add(key);
      }
      kids(n, 'profiles').forEach(addProfile);
      kids(n, 'rules').forEach(addRule);
      for (const link of kids(n, 'infoLinks')) {
        const target = index.get(link.attrs.targetId);
        if (!target) continue;
        const hiddenUnitProfile = target.tag === 'profile' && (target.attrs.typeName ?? '').startsWith('Unit');
        if (link.attrs.hidden === 'true' && !hiddenUnitProfile) continue;
        if (target.tag === 'profile') addProfile(target);
        else if (target.tag === 'rule') addRule(target);
        else walk(target);
      }
      for (const c of [...kids(n, 'selectionEntries'), ...kids(n, 'selectionEntryGroups'), ...kids(n, 'entryLinks')]) {
        if (c.attrs.hidden === 'true' || SKIP_GROUP.test(c.attrs.name ?? '')) continue;
        if (c.tag === 'entryLink') {
          const target = index.get(c.attrs.targetId);
          if (target && target.attrs.hidden !== 'true' && !SKIP_GROUP.test(target.attrs.name ?? '')) walk(target);
        } else walk(c);
      }
    };
    walk(entry);
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
    if (root.attrs.hidden === 'true' || target.attrs.hidden === 'true' || SKIP_GROUP.test(name)) continue;
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
