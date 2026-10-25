/**
 * Which stratagems to show now, by the phases Wahapedia lists for them ('Shooting phase', 'Enemy Shooting phase',
 * 'Any phase', …). The player whose turn it is sees "<Phase> phase"; the other player sees "Enemy <Phase> phase".
 */
import type { StratagemOut } from '@recruit/data/model';
import type { TablePhase } from './game';

const NAME: Record<TablePhase, string> = {
  command: 'Command', movement: 'Movement', psychic: 'Psychic', shooting: 'Shooting', charge: 'Charge', fight: 'Fight', morale: 'Morale',
};
const REACTIONS = ['Being targeted', 'Taking casualties', 'Enemy taking casualties'];
/** Both players act in these phases (both fight; both take Morale tests), so the reacting player sees "<Phase> phase" too. */
const SHARED: TablePhase[] = ['fight', 'morale'];
export const CORE_GROUP = 'Core Book';

/** Bracketed endings that only say where a group comes from: "Blitz Brigade (Specialist Detachment)", "Leviathan (Supplement)". */
const SOURCE_ENDING = /^\((specialist detachment|supplement)\)$/;

/**
 * A stratagem group or a list's choice compared loosely, since BSData names a choice and Wahapedia its group in their
 * own ways: case, either apostrophe ("Vior'la" / "Vior’la"), a leading "The" or "Order of (the)" ("The Ferrymen" /
 * "Ferrymen", "Argent Shroud" / "Order of the Argent Shroud"), a trailing "Sept" ("Vior'la Sept" / "Vior’la"), a plural
 * ("Goffs" / "Goff") and a source ending are ignored. Any other bracketed ending is kept: "chaos space marine (khorne)".
 */
export function groupKey(name: string): string {
  const [, base, bracket] = /^(.*?)\s*(\([^)]*\))?$/.exec(name.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim())!;
  const key = base.replace(/^(the|order of( the)?) /, '').replace(/ sept$/, '').replace(/s$/, '');
  return bracket && !SOURCE_ENDING.test(bracket) ? `${key} ${bracket}` : key;
}

export function phaseFilter(phase: TablePhase, side: 'active' | 'reacting', ctx: { firstCommandOfRound: boolean }): { main: string[]; reactions: string[] } {
  const own = `${NAME[phase]} phase`;
  const enemy = `Enemy ${NAME[phase]} phase`;
  const main = side === 'active' ? [own, 'Any phase', 'Any of your phases', 'Any time'] : [enemy, 'Any phase', 'Any time'];
  if (side === 'reacting' && SHARED.includes(phase)) main.push(own);
  if (ctx.firstCommandOfRound && phase === 'command') main.push('At the start of battle round');
  if (side === 'active' && phase === 'morale') main.push('End of your turn');
  return { main, reactions: REACTIONS };
}

/**
 * Main stratagems for now, then reactions (a stratagem shows once, under main if it fits both). `groups`, when given,
 * keeps only stratagems from those groups.
 */
export function stratagemsFor(all: StratagemOut[], filter: { main: string[]; reactions: string[] }, groups?: Set<string>): { main: StratagemOut[]; reactions: StratagemOut[] } {
  const pool = groups ? all.filter((s) => groups.has(s.group)) : all;
  const main = pool.filter((s) => s.phases.some((p) => filter.main.includes(p)));
  const reactions = pool.filter((s) => !main.includes(s) && s.phases.some((p) => filter.reactions.includes(p)));
  return { main, reactions };
}

/** The CP costs a stratagem can have: "1" → [1], "1/2" → [1, 2], "1-3" → [1, 2, 3]. */
export function costOptions(cp: string): number[] {
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(cp.trim());
  if (range) {
    const [lo, hi] = [Number(range[1]), Number(range[2])];
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }
  return [...new Set(cp.split('/').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}
