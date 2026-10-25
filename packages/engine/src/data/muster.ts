/**
 * A saved army-builder list → an engine army (R-20). The list's units are matched to their datasheets by BattleScribe
 * id; each model's stat line and weapons come from the entries it was chosen through (UnitOut.entries), so every model
 * fights with its own gear. Selections the data has no entry for (older data) are matched to profiles by name. Anything
 * that doesn't match is reported, never guessed: the player fixes it in the sandbox.
 */
import type { UnitOut } from '@recruit/data/model';
import type { RosterView, SelView } from '@recruit/data/roster';
import type { ArmyInput, UnitInput } from '../core/state';
import type { PlayerId } from '../core/types';
import type { Datasheet } from '../datasheet/types';
import { datasheetObjectiveSecured, toDatasheet } from './adapter';

export type MusterProblem = { kind: 'unknown-unit' | 'unmatched-model' | 'unmatched-weapon'; unit: string; detail: string };
export type UnitLookup = Map<string, { unit: UnitOut; catalogueName: string }>;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
const WEAPONISH = /gun|rifle|cannon|blade|sword|axe|claw|pistol|bolter|launcher|flamer|melta|las|spear|staff|fist|hammer|carbine|blaster|lance|maul|glaive|talon|scythe|cleaver|shotgun|mortar|missile|weapon/i;

/** Names an upgrade may stand for: "2x Entropy cannon", "Bolt Pistol & Boltgun", "X w/ Y", plurals ("storm bolters"). */
function candidates(upgrade: string): string[] {
  const parts = upgrade.replace(/^\s*\d+\s*x\s+/i, '').split(/\s+(?:&|and|w\/)\s+/i).map((p) => p.trim()).filter(Boolean);
  return [...new Set(parts.flatMap((p) => [p, p.replace(/s$/i, '')]))];
}

/** Weapon profiles an upgrade selection stands for: the same name, or that name then " -", ",", " (" or " [". */
function weaponsFor(ds: Datasheet, upgrade: string): string[] {
  const out = new Set<string>();
  for (const c of candidates(upgrade)) {
    const u = norm(c);
    for (const w of ds.weapons)
      if (norm(w.name) === u || [',', ' -', ' –', ' (', ' ['].some((sep) => w.name.toLowerCase().startsWith(c.toLowerCase() + sep))) out.add(w.name);
  }
  return [...out];
}

/** The ids a selection was made through: its entry (a link's id for a link) and the entry's target. */
const idsOf = (s: SelView) => [...new Set([s.sel.entryId, s.merged?.target.id].filter((x): x is string => !!x))];
/** Everything chosen below a selection. */
const below = (s: SelView): SelView[] => s.children.filter((c) => c.sel.count > 0).flatMap((c) => [c, ...below(c)]);

/**
 * The datasheet weapons a set of selections brings: from their entries; by name for a selection the data has no entry
 * for (an unmatched weapon-like name is reported once per unit).
 */
function weaponsOf(ds: Datasheet, u: UnitOut, views: SelView[], problems: MusterProblem[], seen: Set<string>): string[] {
  const entries = u.entries ?? {};
  const onSheet = new Set(ds.weapons.map((w) => w.name));
  const out = new Set<string>();
  for (const v of views) {
    const ids = idsOf(v).filter((id) => id in entries);
    if (ids.length) {
      for (const id of ids) for (const i of entries[id].w ?? []) if (onSheet.has(u.weapons[i]?.name)) out.add(u.weapons[i].name);
      continue;
    }
    if (v.type !== 'upgrade') continue;
    const found = weaponsFor(ds, v.name);
    found.forEach((w) => out.add(w));
    if (!found.length && WEAPONISH.test(v.name) && !seen.has(v.name)) {
      seen.add(v.name);
      problems.push({ kind: 'unmatched-weapon', unit: ds.name, detail: v.name });
    }
  }
  return [...out];
}

/**
 * The model profile a model selection uses: the same name; else the name without a trailing "(loadout)"; else the
 * longest profile name the selection name starts with; else the only profile when the datasheet has just one.
 */
function profileFor(ds: Datasheet, name: string): string | null {
  const n = norm(name);
  const bare = norm(name.replace(/\s*\([^)]*\)\s*$/, ''));
  const exact = ds.models.find((p) => norm(p.name) === n || norm(p.name) === bare);
  if (exact) return exact.name;
  const prefix = ds.models.filter((p) => n.startsWith(norm(p.name) + ' ')).sort((a, b) => b.name.length - a.name.length)[0];
  if (prefix) return prefix.name;
  return ds.models.length === 1 ? ds.models[0].name : null;
}

/** The stat line a model selection uses: its entry's; else its kind's; else by name (older data). */
function modelProfile(ds: Datasheet, u: UnitOut, m: SelView): string | null {
  const entries = u.entries ?? {};
  const fromEntry = idsOf(m).map((id) => entries[id]?.m).find((i) => i !== undefined);
  const kind = u.modelKinds?.find((k) => idsOf(m).some((id) => k.entryIds.includes(id)));
  const index = fromEntry ?? (kind && kind.profile >= 0 ? kind.profile : undefined);
  return (index !== undefined ? profileFor(ds, u.models[index]?.name ?? '') : null) ?? profileFor(ds, m.name);
}

function musterUnit(v: SelView, ds: Datasheet, u: UnitOut, id: string, problems: MusterProblem[]): UnitInput | null {
  if (!ds.models.length) {
    problems.push({ kind: 'unmatched-model', unit: ds.name, detail: 'the datasheet has no model profiles' });
    return null;
  }
  const seen = new Set<string>();
  const stacks = new Map<string, { profile: string; weapons: string[]; count: number }>();
  const add = (profile: string, weapons: string[], count: number) => {
    const key = `${profile}|${[...weapons].sort().join('|')}`;
    const s = stacks.get(key);
    if (s) s.count += count;
    else stacks.set(key, { profile, weapons, count });
  };
  // Read the unit: its models at any depth (a squad inside the squad too), with how many of each; and the choices made
  // on the unit itself, which every model carries.
  const models: { m: SelView; count: number }[] = [];
  const unitLevel: SelView[] = [v];
  const walk = (s: SelView, copies: number) => {
    for (const c of s.children.filter((x) => x.sel.count > 0)) {
      if (c.type === 'model') models.push({ m: c, count: copies * c.sel.count });
      else if (c.type === 'unit') {
        unitLevel.push(c);
        walk(c, copies * c.sel.count);
      } else unitLevel.push(c, ...below(c));
    }
  };
  const kinds = u.modelKinds ?? [];
  const single = v.type !== 'unit' || (kinds.length === 1 && idsOf(v).some((x) => kinds[0].entryIds.includes(x)));
  if (!single) walk(v, 1);
  if (!models.length) {
    // A unit that is itself one model (characters, vehicles): its own stat line and everything chosen on it.
    const profile = modelProfile(ds, u, v) ?? ds.models[0].name;
    add(profile, weaponsOf(ds, u, [v, ...below(v)], problems, seen), 1);
  } else {
    const shared = weaponsOf(ds, u, unitLevel, problems, seen);
    for (const { m, count } of models) {
      let profile = modelProfile(ds, u, m);
      if (!profile) {
        problems.push({ kind: 'unmatched-model', unit: ds.name, detail: m.name });
        profile = ds.models[0].name;
      }
      add(profile, [...new Set([...shared, ...weaponsOf(ds, u, [m, ...below(m)], problems, seen)])], count);
    }
  }
  const warlord = below(v).some((s) => s.type === 'upgrade' && s.name.trim() === 'Warlord');
  return { id, datasheet: ds, models: [...stacks.values()], ...(warlord ? { warlord: true } : {}) };
}

export function musterFromRoster(view: RosterView, units: UnitLookup, player: PlayerId): { army: ArmyInput; problems: MusterProblem[] } {
  const problems: MusterProblem[] = [];
  const out: UnitInput[] = [];
  const sheets = new Map<string, Datasheet>();
  for (const force of view.forces) {
    // R-28: these detachments never gain detachment abilities, so only a datasheet's own Objective Secured counts.
    const auxiliary = /auxiliary|fortification network/i.test(force.name);
    for (const v of force.selections) {
      if (v.type === 'upgrade' || v.sel.count <= 0) continue;
      const targetId = v.merged?.target.id ?? v.sel.entryId;
      const found = units.get(targetId);
      if (!found) {
        problems.push({ kind: 'unknown-unit', unit: v.name, detail: `no datasheet for entry ${targetId}` });
        continue;
      }
      const key = auxiliary ? `${targetId}|auxiliary` : targetId;
      let ds = sheets.get(key);
      if (!ds) {
        ds = toDatasheet(found.unit, found.catalogueName).datasheet;
        if (auxiliary) ds = { ...ds, objectiveSecured: datasheetObjectiveSecured(found.unit) };
        sheets.set(key, ds);
      }
      for (let copy = 0; copy < v.sel.count; copy++) {
        const u = musterUnit(v, ds, found.unit, v.sel.count > 1 ? `${v.sel.id}#${copy + 1}` : v.sel.id, problems);
        if (u) out.push(u);
      }
    }
  }
  return { army: { player, name: view.roster.name, units: out, cpSpentPreBattle: 0 }, problems };
}
