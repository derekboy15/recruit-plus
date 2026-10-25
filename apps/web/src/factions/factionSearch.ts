/** Finding a faction by the names players actually use: "space marines", "guard", "eldar", "tau". */
import type { CatalogueSummary } from '@recruit/data/model';
import { factionDisplayName } from './names';

/** Everyday and older names → words in the catalogue's full name. */
const ALIASES: Record<string, string> = {
  'space marines': 'adeptus astartes',
  'space marine': 'adeptus astartes',
  marines: 'adeptus astartes',
  astartes: 'adeptus astartes',
  'imperial guard': 'astra militarum',
  guard: 'astra militarum',
  'sisters of battle': 'adepta sororitas',
  sisters: 'adepta sororitas',
  admech: 'adeptus mechanicus',
  'ad mech': 'adeptus mechanicus',
  eldar: 'aeldari',
  'dark eldar': 'drukhari',
  demons: 'daemons',
  squats: 'leagues of votann',
};

/** Lower case, no apostrophes, single spaces. */
const norm = (s: string) => s.toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Whether a faction matches the search. The name shown always counts; from three letters the full catalogue name
 * ("Imperium - Adeptus Astartes - …") and the start of an alias count too, so "as" doesn't list every chapter.
 */
export function factionMatches(c: Pick<CatalogueSummary, 'name'>, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  if (norm(factionDisplayName(c.name)).includes(q)) return true;
  if (q.length < 3) return false;
  const full = norm(c.name);
  return full.includes(q) || Object.entries(ALIASES).some(([alias, target]) => alias.startsWith(q) && full.includes(target));
}

const LEGENDS = /\s*\[legends\]/i;

/** The name a player sees, whether it is a Legends faction, and the family a Space Marine chapter belongs to. */
export function factionLabel(c: Pick<CatalogueSummary, 'name'>): { name: string; legends: boolean; family: 'Space Marines' | null } {
  const display = factionDisplayName(c.name);
  return {
    name: display.replace(LEGENDS, '').trim(),
    legends: LEGENDS.test(display),
    family: c.name.includes('Adeptus Astartes') ? 'Space Marines' : null,
  };
}
