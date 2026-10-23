/**
 * A saved army-builder list → an engine army (R-20). The list's units are matched to their datasheets by BattleScribe
 * id; model and weapon selections are matched to profiles by name. Anything that doesn't match is reported, never
 * guessed: the player fixes it in the sandbox.
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

function* upgrades(views: SelView[]): Generator<SelView> {
  for (const v of views) {
    if (v.sel.count <= 0) continue;
    if (v.type === 'upgrade') yield v;
    yield* upgrades(v.children.filter((c) => c.type === 'upgrade'));
  }
}

function weaponsOf(ds: Datasheet, views: SelView[], unitName: string, problems: MusterProblem[], seen: Set<string>): string[] {
  const out = new Set<string>();
  for (const up of upgrades(views)) {
    const found = weaponsFor(ds, up.name);
    found.forEach((w) => out.add(w));
    if (!found.length && WEAPONISH.test(up.name) && !seen.has(up.name)) {
      seen.add(up.name);
      problems.push({ kind: 'unmatched-weapon', unit: unitName, detail: up.name });
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

function musterUnit(v: SelView, ds: Datasheet, id: string, problems: MusterProblem[]): UnitInput | null {
  if (!ds.models.length) {
    problems.push({ kind: 'unmatched-model', unit: ds.name, detail: 'the datasheet has no model profiles' });
    return null;
  }
  const seen = new Set<string>();
  const unitLevel = v.children.filter((c) => c.type === 'upgrade');
  const shared = weaponsOf(ds, unitLevel, ds.name, problems, seen);
  const stacks = new Map<string, { profile: string; weapons: string[]; count: number }>();
  const add = (profile: string, weapons: string[], count: number) => {
    const key = `${profile}|${[...weapons].sort().join('|')}`;
    const s = stacks.get(key);
    if (s) s.count += count;
    else stacks.set(key, { profile, weapons, count });
  };
  const models = v.children.filter((c) => c.type === 'model' && c.sel.count > 0);
  if (!models.length) {
    // A unit that is itself one model (characters, vehicles): its own name, or the first profile.
    const profile = profileFor(ds, v.name) ?? ds.models[0].name;
    add(profile, [...new Set([...shared])], 1);
  }
  for (const m of models) {
    let profile = profileFor(ds, m.name);
    if (!profile) {
      problems.push({ kind: 'unmatched-model', unit: ds.name, detail: m.name });
      profile = ds.models[0].name;
    }
    add(profile, [...new Set([...shared, ...weaponsOf(ds, m.children, ds.name, problems, seen)])], m.sel.count);
  }
  const warlord = [...upgrades(v.children)].some((u) => u.name.trim() === 'Warlord');
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
        const u = musterUnit(v, ds, v.sel.count > 1 ? `${v.sel.id}#${copy + 1}` : v.sel.id, problems);
        if (u) out.push(u);
      }
    }
  }
  return { army: { player, name: view.roster.name, units: out, cpSpentPreBattle: 0 }, problems };
}
