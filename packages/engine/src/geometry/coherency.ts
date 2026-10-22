/** Unit coherency (TS §1.2, R-2) and the end-of-turn coherency removals (TS §8.3). */
import { horizontalGap, verticalGap, within } from './measure';
import type { Placed } from './shapes';

const neighbours = (a: Placed, b: Placed) => within(horizontalGap(a, b), 2) && within(verticalGap(a, b), 5);

function graph(models: Placed[]): Map<string, string[]> {
  const g = new Map(models.map((m) => [m.id, [] as string[]]));
  for (let i = 0; i < models.length; i++)
    for (let j = i + 1; j < models.length; j++)
      if (neighbours(models[i], models[j])) {
        g.get(models[i].id)!.push(models[j].id);
        g.get(models[j].id)!.push(models[i].id);
      }
  return g;
}

/** Connected groups of models, each listed in the input order. */
export function coherentGroups(models: Placed[]): string[][] {
  const g = graph(models);
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const m of models) {
    if (seen.has(m.id)) continue;
    const group = new Set<string>([m.id]);
    const stack = [m.id];
    seen.add(m.id);
    while (stack.length) for (const n of g.get(stack.pop()!)!) if (!seen.has(n)) (seen.add(n), group.add(n), stack.push(n));
    groups.push(models.filter((x) => group.has(x.id)).map((x) => x.id));
  }
  return groups;
}

/** Every model has 1 neighbour (2 at 6+ models) within 2" horizontally and 5" vertically, as one single group. */
export function inCoherency(models: Placed[]): boolean {
  if (models.length <= 1) return true;
  const need = models.length >= 6 ? 2 : 1;
  const g = graph(models);
  if ([...g.values()].some((n) => n.length < need)) return false;
  return coherentGroups(models).length === 1;
}

/**
 * Models to remove until one coherent group remains: keep the largest connected group (ties: the one listed first),
 * then repeatedly drop the model with the fewest neighbours (ties: earliest in the casualty order).
 */
export function coherencyRemovals(models: Placed[], casualtyOrder: string[]): string[] {
  const removed: string[] = [];
  let left = models;
  const rank = (id: string) => {
    const i = casualtyOrder.indexOf(id);
    return i < 0 ? casualtyOrder.length : i;
  };
  while (!inCoherency(left)) {
    const groups = coherentGroups(left);
    if (groups.length > 1) {
      const keep = groups.reduce((best, g) => (g.length > best.length ? g : best));
      removed.push(...left.filter((m) => !keep.includes(m.id)).map((m) => m.id));
      left = left.filter((m) => keep.includes(m.id));
      continue;
    }
    const g = graph(left);
    const victim = [...left].sort((a, b) => g.get(a.id)!.length - g.get(b.id)!.length || rank(a.id) - rank(b.id))[0];
    removed.push(victim.id);
    left = left.filter((m) => m.id !== victim.id);
  }
  return removed;
}
