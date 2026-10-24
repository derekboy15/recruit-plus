/** The read-only army Play mode shows: units by role with what they carry and their datasheets. Pure, no React. */
import type { UnitOut } from '@recruit/data/model';
import type { SelView } from '@recruit/data/roster';

/** For matching names: lower case, trimmed, single spaces, curly apostrophes straight. */
const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Every selection under `v` with its number of copies (the product of the counts down to it), none of them zero. */
function counted(children: SelView[], copies = 1): { name: string; qty: number }[] {
  return children.flatMap((c) => {
    const qty = copies * c.sel.count;
    return qty > 0 ? [{ name: norm(c.name), qty }, ...counted(c.children, qty)] : [];
  });
}

/**
 * The datasheet's weapon profiles this unit carries: a profile matches a selection by name, or as one of its modes
 * ("Staff of Light" → "Staff of Light (Shooting)" and "(Melee)"), ignoring case, spacing and apostrophes. A weapon the
 * unit has several of reads "10x Gauss Flayer", which DatasheetView shows as ×10. Undefined when nothing matches, so
 * the datasheet shows every weapon rather than none.
 */
export function takenWeapons(v: SelView, unit: UnitOut): string[] | undefined {
  const held = new Map<string, number>();
  for (const { name, qty } of counted(v.children)) held.set(name, (held.get(name) ?? 0) + qty);
  const out: string[] = [];
  for (const p of unit.weapons) {
    const name = norm(p.name);
    const qty = [...held].find(([h]) => name === h || name.startsWith(`${h} (`))?.[1];
    if (qty !== undefined) out.push(qty > 1 ? `${qty}x ${p.name}` : p.name);
  }
  return out.length ? out : undefined;
}
