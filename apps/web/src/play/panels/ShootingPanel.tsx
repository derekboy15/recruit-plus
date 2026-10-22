/** The Shooting phase: pick a unit, choose a target for each of its weapons (tap an enemy on the board), and shoot. */
import {
  eligibleUnits,
  formatDice,
  livingModels,
  onBoard,
  outerRadius,
  sheetOf,
  weaponBase,
  type Assignment,
  type GameState,
  type Problem,
  type WeaponProfile,
} from '@recruit/engine';
import { useEffect, useState } from 'react';
import type { Ring } from '../board/scene';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';

/** One weapon of the unit (all its profiles, R-16) and the models that carry it. */
export interface WeaponGroup { key: string; name: string; profiles: string[]; modelIds: string[]; first: WeaponProfile }
export interface WeaponChoice { on: boolean; profile: string; target: string | null }

const displayName = (name: string) => name.split(/\s+[-–]\s+|\s*\(|\s*\[|,\s*/)[0].trim();
const isOther = (w: WeaponProfile) => w.type !== 'Pistol' && w.type !== 'Grenade' && w.type !== 'Melee';

export function weaponGroups(s: GameState, unitId: string): WeaponGroup[] {
  const ds = sheetOf(s, unitId);
  const groups = new Map<string, WeaponGroup>();
  for (const w of ds.weapons) {
    if (w.type === 'Melee') continue;
    const carriers = livingModels(s, unitId).filter((m) => m.weapons.includes(w.name)).map((m) => m.id);
    if (!carriers.length) continue;
    const key = weaponBase(w.name);
    const g = groups.get(key) ?? { key, name: displayName(w.name), profiles: [], modelIds: [], first: w };
    g.profiles.push(w.name);
    g.modelIds = [...new Set([...g.modelIds, ...carriers])];
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Every weapon on, at no target yet; grenades off, and pistols off for models that carry other guns. */
export function defaultChoices(s: GameState, groups: WeaponGroup[]): Record<string, WeaponChoice> {
  const out: Record<string, WeaponChoice> = {};
  for (const g of groups) {
    const unitId = s.models[g.modelIds[0]].unitId;
    const sheet = sheetOf(s, unitId);
    const hasOther = (id: string) => s.models[id].weapons.some((n) => sheet.weapons.some((w) => w.name === n && isOther(w)));
    const off = g.first.type === 'Grenade' || (g.first.type === 'Pistol' && g.modelIds.every(hasOther));
    out[g.key] = { on: !off, profile: g.profiles[0], target: null };
  }
  return out;
}

export function assignmentsFor(groups: WeaponGroup[], choices: Record<string, WeaponChoice>, s?: GameState): Assignment[] {
  return groups.flatMap((g) => {
    const c = choices[g.key];
    if (!c?.on || !c.target) return [];
    return g.modelIds.filter((id) => !s || s.models[id].weapons.includes(c.profile)).map((modelId) => ({ modelId, weapon: c.profile, targetUnitId: c.target! }));
  });
}

const groupLabel = (g: WeaponGroup) => {
  const w = g.first;
  return `${g.name} ×${g.modelIds.length}, ${w.range ?? '–'}" ${w.type === 'Other' ? '' : `${w.type} `}${formatDice(w.shots)}`.replace(/\s+/g, ' ');
};

export function ShootingPanel({ sb, ui }: PanelProps) {
  const s = sb.state;
  const player = s.active;
  const units = eligibleUnits(s, 'shoot');
  const unitId = ui.selectedUnitId && units.includes(ui.selectedUnitId) ? ui.selectedUnitId : null;
  const groups = unitId ? weaponGroups(s, unitId) : [];
  const [choices, setChoices] = useState<Record<string, WeaponChoice>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const enemies = Object.values(s.units).filter((u) => u.player !== player && u.location === 'battlefield' && onBoard(s, u.id).length);

  useEffect(() => {
    setChoices(unitId ? defaultChoices(s, weaponGroups(s, unitId)) : {});
    setFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  // Taps: an enemy model sets the target (of the weapon in focus, else of every weapon without one); your own picks a unit.
  useEffect(() => {
    ui.setTapHandler((_at, modelId) => {
      if (!modelId) return;
      const m = s.models[modelId];
      if (s.units[m.unitId].player === player) return ui.select(m.unitId);
      setChoices((c) => {
        const next = { ...c };
        for (const [k, v] of Object.entries(c)) if (focus ? k === focus : v.on && !v.target) next[k] = { ...v, target: m.unitId };
        return next;
      });
    });
    return () => ui.setTapHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, s, player]);

  const targets = [...new Set(Object.values(choices).filter((c) => c.on && c.target).map((c) => c.target!))];
  const targetKey = targets.join('|');
  useEffect(() => ui.setTargets(targetKey ? targetKey.split('|') : []), [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const g = groups.find((x) => x.key === focus);
    if (!g || !unitId) return ui.setRings([]);
    const profile = sheetOf(s, unitId).weapons.find((w) => w.name === (choices[g.key]?.profile ?? g.profiles[0])) ?? g.first;
    const r = (profile.range ?? 0) + outerRadius(sheetOf(s, unitId).base);
    const rings: Ring[] = g.modelIds.filter((id) => s.models[id].pos).map((id, i) => ({ center: { x: s.models[id].pos!.x, y: s.models[id].pos!.y }, r, kind: 'weapon', ...(i === 0 ? { label: `${profile.range}"` } : {}) }));
    ui.setRings(rings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, unitId, choices[focus ?? '']?.profile]);

  const set = (key: string, patch: Partial<WeaponChoice>) => setChoices((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  const run = (problems: Problem[] | null) => {
    ui.setProblems(problems ?? []);
    ui.setInvalid((problems ?? []).flatMap((p) => p.modelIds ?? []));
    return !problems;
  };
  const shoot = () => {
    if (!unitId) return;
    if (run(sb.act({ type: 'shoot', by: player, unitId, assignments: assignmentsFor(groups, choices, s) }))) {
      ui.select(null);
      ui.setRings([]);
      ui.setTargets([]);
    }
  };

  return (
    <section>
      <h2>Shooting</h2>
      <UnitPicker units={units} state={s} selected={unitId} onPick={(id) => ui.select(id)} label="Units that can shoot" />
      {unitId && (
        <div className="play-weapons">
          <p className="muted">Tap an enemy unit on the board to target it with the weapons below.</p>
          {groups.map((g) => {
            const c = choices[g.key];
            if (!c) return null;
            return (
              <div key={g.key} className="play-weapon" data-focus={focus === g.key}>
                <label className="choices__option">
                  <input type="checkbox" checked={c.on} onChange={(e) => set(g.key, { on: e.target.checked })} />
                  <span>{groupLabel(g)}</span>
                </label>
                {g.profiles.length > 1 && (
                  <div className="seg" role="group" aria-label={`${g.name} profile`}>
                    {g.profiles.map((p) => (
                      <button key={p} type="button" className="seg__btn" aria-pressed={c.profile === p} onClick={() => set(g.key, { profile: p })}>
                        {p.slice(g.name.length).replace(/^[\s,–-]+/, '') || p}
                      </button>
                    ))}
                  </div>
                )}
                <div className="play-row">
                  <select aria-label={`Target for ${g.name}`} value={c.target ?? ''} onChange={(e) => set(g.key, { target: e.target.value || null })}>
                    <option value="">No target</option>
                    {enemies.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn--small" aria-pressed={focus === g.key} aria-label={`Show range: ${g.name}`} onClick={() => setFocus((f) => (f === g.key ? null : g.key))}>
                    Range
                  </button>
                </div>
              </div>
            );
          })}
          <button type="button" className="btn btn--primary" disabled={!assignmentsFor(groups, choices, s).length} onClick={shoot}>
            Shoot
          </button>
        </div>
      )}
      <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endPhase', by: player }))}>
        End Shooting phase
      </button>
    </section>
  );
}
