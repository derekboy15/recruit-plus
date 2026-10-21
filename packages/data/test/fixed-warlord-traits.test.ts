/**
 * Fixed Warlord Traits under the Arks of Omen Warlord Trait Requisition (research library
 * 01_Core_Rules/Army_Building_Detachments_and_CP.md §5, §6): a Warlord only gets a Warlord Trait, a named character's
 * listed one included, when you pay 1 CP for the Warlord Trait Requisition Stratagem ("Stratagem: Warlord Trait" in
 * BSData). BSData v9.8.0 instead makes many named characters' listed traits compulsory as soon as they are the Warlord:
 * a modifier sets the trait's min to 1 when the character holds its "Warlord" upgrade, or whenever the roster has no
 * "4. Chapter Approved: War Zone Nephilim" (e77a-cc54-efcf-a09a, the 2022 mission pack, the only one BSData exempts).
 * overrides/constraints.json pins those minimums at 0.
 *
 * This scans the generated roster data (npm run data:build) for any such minimum left, so a data bump can't bring one
 * back: a min constraint that a modifier sets to 1 or more (or increments) when its condition names a "Warlord" entry or
 * War Zone Nephilim, and that can fire, on an option that can be shown, in this situation:
 * - the roster holds "5. Chapter Approved: Arks of Omen" and not War Zone Nephilim;
 * - the character is the Warlord (its "Warlord" upgrade is taken);
 * - it has taken no Stratagem upgrade (the Requisition, which no other unit can take either, or a codex one that grants
 *   a trait: §6 lets those still work).
 * Any other condition counts as possibly true (three-valued), so the scan errs towards reporting. A minimum raised by
 * something else (Grey Knights' "Pre Game Enforcement" option, Black Legion's paid Lord of the Ezakarion) is not
 * this rule and isn't reported; nor is one on an option hidden there (the Legends characters' "Stratagem: Warlord
 * Trait" links, already pinned, shown only under War Zone Nephilim).
 */
import { describe, expect, test } from 'vitest';
import type { Cond, CondGroup, Constraint, Mod, RNode, RosterFile } from '../src/roster/types';
import { realCatalogues, realFiles } from './helpers/realScope';

const NEPHILIM = 'e77a-cc54-efcf-a09a';
const ARKS_OF_OMEN = '76d2-6e71-243f-ad3d';
/** The .gst's "Stratagem: Warlord Trait": once per army, on the Warlord, so not taken anywhere in the situation. */
const REQUISITION = '6771-6ab3-1672-6a39';

type Maybe = boolean | undefined;

function* walk(nodes: RNode[] = []): Generator<RNode> {
  for (const n of nodes) {
    yield n;
    yield* walk(n.children);
  }
}

const files: RosterFile[] = realFiles(...realCatalogues().map((c) => c.slug));
const nodes = files.flatMap((f) => [...walk(f.rootEntries), ...walk(f.shared)].map((n) => ({ file: f, n })));
const byId = new Map(nodes.map(({ n }) => [n.id, n]));
const idsOf = (wanted: (n: RNode) => boolean) => new Set(nodes.filter(({ n }) => wanted(n)).flatMap(({ n }) => [n.id, ...(n.targetId ? [n.targetId] : [])]));
const WARLORD = idsOf((n) => n.name.trim() === 'Warlord');
const STRATAGEM = idsOf((n) => n.name.trim().startsWith('Stratagem:'));

const refs = (g: CondGroup | undefined, ids: Set<string>): boolean => !!g && (g.conds.some((c) => ids.has(c.childId)) || g.groups.some((x) => refs(x, ids)));

/** A condition's count in the situation above, or undefined when it depends on anything else. */
function count(c: Cond): number | undefined {
  if (c.field !== 'selections') return undefined;
  const wide = c.scope === 'roster' || c.scope === 'force';
  if (c.childId === NEPHILIM || c.childId === REQUISITION) return 0;
  if (c.childId === ARKS_OF_OMEN) return wide ? 1 : undefined;
  if (!wide && STRATAGEM.has(c.childId)) return 0;
  if (!wide && WARLORD.has(c.childId)) return 1;
  return undefined;
}

function holds(c: Cond): Maybe {
  const k = count(c);
  if (k === undefined) return undefined;
  switch (c.type) {
    case 'lessThan': return k < c.value;
    case 'greaterThan': return k > c.value;
    case 'equalTo': return k === c.value;
    case 'notEqualTo': return k !== c.value;
    case 'atLeast': return k >= c.value;
    case 'atMost': return k <= c.value;
    default: return undefined;
  }
}

function fires(g: CondGroup | undefined): Maybe {
  if (!g) return true;
  const vs = [...g.conds.map(holds), ...g.groups.map(fires)];
  if (g.type === 'and') return vs.includes(false) ? false : vs.every((v) => v === true) ? true : undefined;
  return vs.includes(true) ? true : vs.every((v) => v === false) ? false : undefined;
}

/** Whether the node (and a link's target) can be shown: false only when it is surely hidden. */
function canShow(n: RNode): boolean {
  const own = [n, ...(n.targetId && byId.has(n.targetId) ? [byId.get(n.targetId)!] : [])];
  const hiding = own.flatMap((x) => x.mods ?? []).filter((m) => m.field === 'hidden' && m.type === 'set');
  const unhide = hiding.filter((m) => m.value === 'false').map((m) => fires(m.when));
  if (own.some((x) => x.hidden)) return unhide.some((v) => v !== false);
  return !hiding.some((m) => m.value === 'true' && fires(m.when) === true) || unhide.some((v) => v !== false);
}

const raises = (m: Mod) => (m.type === 'set' && Number(m.value) >= 1) || m.type === 'increment';

describe('fixed Warlord Traits under the Arks of Omen Warlord Trait Requisition (§5, §6)', () => {
  test('the situation is recognised: Warlord, Stratagem and pack ids are found', () => {
    expect(WARLORD.size).toBeGreaterThan(20);
    expect(STRATAGEM.has(REQUISITION)).toBe(true);
  });

  test('no named Warlord is made to take a Warlord Trait without paying for it', () => {
    const owners = new Map<string, { file: RosterFile; n: RNode; c: Constraint }[]>();
    for (const { file, n } of nodes) for (const c of n.constraints ?? []) if (c.type === 'min') owners.set(c.id, [...(owners.get(c.id) ?? []), { file, n, c }]);
    const found = new Set<string>();
    for (const { n: holder } of nodes) for (const m of holder.mods ?? []) {
      if (!raises(m) || !(refs(m.when, WARLORD) || refs(m.when, new Set([NEPHILIM])))) continue;
      if (fires(m.when) === false) continue;
      for (const { file, n, c } of owners.get(m.field) ?? []) if (canShow(n)) found.add(`${file.name}: ${n.name} (${c.id})`);
    }
    expect([...found].sort()).toEqual([]);
  });
});
