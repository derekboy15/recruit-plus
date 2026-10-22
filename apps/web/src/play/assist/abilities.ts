/** Faction texts for the game: each unit's abilities (from the generated data), army rules and stratagems by player. */
import type { AbilityOut, CatalogueOut, StratagemOut, UnitOut } from '@recruit/data/model';
import type { Phase, PlayerId } from '@recruit/engine';
import { useEffect, useState } from 'react';
import { getCatalogue, getCoreStratagems } from '../../factions/dataClient';
import type { GameMeta } from '../store/gameStore';

/** Words that make an ability worth showing first in a phase. */
export const PHASE_WORDS: Record<Phase, RegExp> = {
  'pre-battle': /deploy|set up|before the battle|reserve|infiltrat|scout/i,
  command: /command phase|\bcp\b|command point|start of (?:the |every |each )?battle round/i,
  movement: /\b(move|moves|moved|advance|fall back|deep strike|set up|arriv)/i,
  psychic: /psych|manifest|deny|warp/i,
  shooting: /shoot|ranged|hit roll|wound roll|cover|targeted/i,
  charge: /charge|overwatch|heroic/i,
  fight: /fight|melee|attacks|pile in|consolidat/i,
  morale: /morale|leadership|combat attrition/i,
  ended: /$^/,
};
/** Core abilities that matter all game long go last, so the moment's own rules lead. */
const EVERYWHERE = new Set(['objective secured']);

const textOf = (a: AbilityOut) => a.plain ?? a.text;
export const isRelevant = (a: AbilityOut, phase: Phase) => !EVERYWHERE.has(a.name.toLowerCase()) && PHASE_WORDS[phase].test(textOf(a));

/** The unit's abilities, the ones that mention this phase first; core abilities shown everywhere go last. */
export function relevantAbilities(u: UnitOut, phase: Phase): AbilityOut[] {
  const rank = (a: AbilityOut) => (EVERYWHERE.has(a.name.toLowerCase()) ? 2 : isRelevant(a, phase) ? 0 : 1);
  return u.abilities.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i).map((x) => x.a);
}

export type UnitTexts = Map<string, UnitOut>;
export interface FactionTexts {
  texts: UnitTexts;
  armyRules: Record<PlayerId, CatalogueOut['rules']>;
  stratagems: Record<PlayerId, StratagemOut[]>;
  loading: boolean;
  error: string | null;
}

const EMPTY: FactionTexts = { texts: new Map(), armyRules: { A: [], B: [] }, stratagems: { A: [], B: [] }, loading: true, error: null };

/** Loads the catalogues both armies come from (and the core stratagems) once per game. */
export function useUnitTexts(meta: GameMeta): FactionTexts {
  const key = meta.armies.map((a) => `${a.player}:${a.catalogueSlugs.join(',')}`).join('|');
  const [out, setOut] = useState<FactionTexts>(EMPTY);
  useEffect(() => {
    let live = true;
    const slugs = [...new Set(meta.armies.flatMap((a) => a.catalogueSlugs))];
    void Promise.all([Promise.allSettled(slugs.map(getCatalogue)), getCoreStratagems().catch(() => [] as StratagemOut[])]).then(([cats, core]) => {
      if (!live) return;
      const bySlug = new Map<string, CatalogueOut>();
      cats.forEach((r, i) => r.status === 'fulfilled' && bySlug.set(slugs[i], r.value));
      const texts: UnitTexts = new Map();
      for (const c of bySlug.values()) for (const u of c.units) if (!texts.has(u.id)) texts.set(u.id, u);
      const result: FactionTexts = { texts, armyRules: { A: [], B: [] }, stratagems: { A: [], B: [] }, loading: false, error: null };
      for (const a of meta.armies) {
        const mine = a.catalogueSlugs.map((s) => bySlug.get(s)).filter((c): c is CatalogueOut => !!c);
        const rules = new Map<string, CatalogueOut['rules'][number]>();
        const strats = new Map<string, StratagemOut>();
        for (const c of mine) {
          for (const r of c.rules) if (!rules.has(r.id)) rules.set(r.id, r);
          for (const st of c.stratagems) if (!strats.has(st.id)) strats.set(st.id, st);
        }
        for (const st of core) if (!strats.has(st.id)) strats.set(st.id, st);
        result.armyRules[a.player] = [...rules.values()];
        result.stratagems[a.player] = [...strats.values()];
      }
      if (cats.some((r) => r.status === 'rejected')) result.error = "Some faction rules couldn't be loaded on this device.";
      setOut(result);
    });
    return () => {
      live = false;
    };
    // The key stands for the armies' catalogues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return out;
}
