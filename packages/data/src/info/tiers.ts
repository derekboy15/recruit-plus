/**
 * How early a player meets an army-building option, from where it sits in the roster files: Plan F writes the options'
 * plain English in this order. Pure.
 */
import { optionDisplay } from '../roster/names';
import type { RNode, RosterFile } from '../roster/types';

/** 1 army choices (sub-faction codes, Army of Renown…), 2 Warlord traits, 3 relics, 4 unit options (stratagem upgrades, psychic powers, wargear). */
export type OptionTier = 1 | 2 | 3 | 4;
export const TIER_NAMES: Record<OptionTier, string> = { 1: 'army choices', 2: 'Warlord traits', 3: 'relics', 4: 'unit options' };
/** The tier of the option with this id in this roster file (info files are keyed the same way). */
export type TierOf = (slug: string, entryId: string) => OptionTier;

interface Occurrence {
  slug: string;
  node: RNode;
  /** The nodes above it, outermost first. */
  chain: RNode[];
  root: 'root' | 'shared';
}

const best = (tiers: OptionTier[]): OptionTier => (tiers.length ? (Math.min(...tiers) as OptionTier) : 4);
const heading = (n: RNode) => optionDisplay(n.name).heading ?? '';
/** BattleScribe's reference copies ("[Reference] Warlord Traits (All)"), which the builder never shows (apps/web lists/editorView.ts). */
const REFERENCE = /\(Reference\)|\[Reference\]/i;

/**
 * A node's tier, from the node and the nodes above it: a trait (marker or "Warlord trait" heading) is 2, a relic 3;
 * anything under a unit or model is 4; anything else under a root entry is an army choice. A shared node has no context
 * of its own, so it takes the best tier of the links (in any file) that reach its top shared node; none reach it: 4.
 * Reference copies and everything under them are left out: a use no player sees gives no tier.
 */
export function optionTierOf(files: RosterFile[]): TierOf {
  const byId = new Map<string, Occurrence[]>();
  const linksTo = new Map<string, Occurrence[]>();
  const push = (m: Map<string, Occurrence[]>, id: string, o: Occurrence) => m.set(id, [...(m.get(id) ?? []), o]);
  for (const f of files) {
    const visit = (node: RNode, chain: RNode[], root: Occurrence['root']) => {
      if (REFERENCE.test(node.name)) return;
      const o = { slug: f.slug, node, chain, root };
      push(byId, node.id, o);
      if (node.kind === 'link' && node.targetId) push(linksTo, node.targetId, o);
      for (const c of node.children ?? []) visit(c, [...chain, node], root);
    };
    for (const n of f.rootEntries) visit(n, [], 'root');
    for (const n of f.shared) visit(n, [], 'shared');
  }
  const entryType = (id: string | undefined) => (id ? byId.get(id)?.find((o) => o.node.kind === 'entry')?.node.type : undefined);
  const isUnit = (n: RNode) => {
    const type = n.kind === 'link' ? entryType(n.targetId) : n.type;
    return type === 'unit' || type === 'model';
  };

  const tierOf = (o: Occurrence, seen: Set<string>): OptionTier => {
    const nodes = [...o.chain, o.node];
    if (nodes.some((n) => n.extraKind === 'trait' || heading(n).startsWith('Warlord trait'))) return 2;
    if (nodes.some((n) => n.extraKind === 'relic' || /^Relic( ·|$)/.test(heading(n)))) return 3;
    if (nodes.some(isUnit)) return 4;
    if (o.root === 'root') return 1;
    const top = nodes[0].id;
    if (seen.has(top)) return 4;
    seen.add(top);
    return best((linksTo.get(top) ?? []).map((l) => tierOf(l, seen)));
  };

  return (slug, entryId) => {
    const all = byId.get(entryId) ?? [];
    const own = all.filter((o) => o.slug === slug);
    return best((own.length ? own : all).map((o) => tierOf(o, new Set())));
  };
}
