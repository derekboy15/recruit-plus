/** The Fight phase: the engine says who picks and which units; pile in, share out attacks, then consolidate. */
import { CLOSE_COMBAT_WEAPON, charsOf, effectsFor, fightOrder, meleeTargets, onBoard, sheetOf, type GameState, type Problem } from '@recruit/engine';
import { useEffect, useState } from 'react';
import { armyName } from '../game/names';
import { PlanMove } from './PlanMove';
import type { PanelProps } from './types';
import { UnitPicker } from './UnitPicker';

/** Models of the unit that can fight, grouped when they have the same profile, weapons and reachable targets. */
interface FightGroup { key: string; label: string; modelIds: string[]; weapons: string[]; targets: string[]; attacks: number | null }
interface Row { weapon: string; attacks: number }
interface GroupChoice { rows: Row[]; target: string }

export function fightGroups(s: GameState, unitId: string): FightGroup[] {
  const ds = sheetOf(s, unitId);
  const extra = effectsFor(s, unitId, 'attacking').reduce((x, e) => x + (e.kind === 'attacks' ? e.value : 0), 0);
  const groups = new Map<string, FightGroup>();
  for (const m of onBoard(s, unitId)) {
    const targets = meleeTargets(s, m);
    if (!targets.length) continue;
    const melee = m.weapons.filter((w) => ds.weapons.some((x) => x.name === w && x.type === 'Melee'));
    const weapons = melee.length ? melee : [CLOSE_COMBAT_WEAPON.name];
    const A = charsOf(s, m).A;
    const attacks = A.n === 0 ? A.plus + extra : null;
    const key = [m.profile, weapons.join('+'), targets.join('+'), attacks].join('|');
    const g = groups.get(key) ?? { key, label: m.profile, modelIds: [], weapons, targets, attacks };
    g.modelIds.push(m.id);
    groups.set(key, g);
  }
  return [...groups.values()];
}

const defaults = (groups: FightGroup[]): Record<string, GroupChoice> =>
  Object.fromEntries(groups.map((g) => [g.key, { rows: [{ weapon: g.weapons[0], attacks: g.attacks ?? 1 }], target: g.targets[0] }]));

function Attacks({ sb, ui, unitId }: PanelProps & { unitId: string }) {
  const s = sb.state;
  const groups = fightGroups(s, unitId);
  const [choices, setChoices] = useState<Record<string, GroupChoice>>(() => defaults(groups));
  const player = s.units[unitId].player;
  const set = (key: string, f: (c: GroupChoice) => GroupChoice) => setChoices((c) => ({ ...c, [key]: f(c[key]) }));
  const fight = () => {
    const assignments = groups.flatMap((g) => {
      const c = choices[g.key];
      return g.modelIds.flatMap((modelId) => c.rows.map((r) => ({ modelId, weapon: r.weapon, attacks: r.attacks, targetUnitId: c.target })));
    });
    ui.setProblems((sb.act({ type: 'fightAttacks', by: player, unitId, assignments }) as Problem[] | null) ?? []);
  };
  return (
    <div className="play-weapons">
      {groups.map((g) => {
        const c = choices[g.key];
        if (!c) return null;
        return (
          <div key={g.key} className="play-weapon">
            <p>
              <strong>
                {g.label} ×{g.modelIds.length}
              </strong>{' '}
              <span className="muted">{g.attacks === null ? 'random Attacks: enter what you rolled' : `${g.attacks} ${g.attacks === 1 ? 'attack' : 'attacks'} each`}</span>
            </p>
            {c.rows.map((r, i) => (
              <div key={i} className="play-row">
                <select aria-label={`Weapon for ${g.label}`} value={r.weapon} onChange={(e) => set(g.key, (x) => ({ ...x, rows: x.rows.map((y, j) => (j === i ? { ...y, weapon: e.target.value } : y)) }))}>
                  {g.weapons.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn--small" aria-label={`Fewer attacks with ${r.weapon}`} onClick={() => set(g.key, (x) => ({ ...x, rows: x.rows.map((y, j) => (j === i ? { ...y, attacks: Math.max(1, y.attacks - 1) } : y)) }))}>
                  −
                </button>
                <span className="play-count" aria-label={`Attacks with ${r.weapon}`}>
                  {r.attacks}
                </span>
                <button type="button" className="btn btn--small" aria-label={`More attacks with ${r.weapon}`} onClick={() => set(g.key, (x) => ({ ...x, rows: x.rows.map((y, j) => (j === i ? { ...y, attacks: y.attacks + 1 } : y)) }))}>
                  +
                </button>
              </div>
            ))}
            {g.weapons.length > 1 && c.rows.length < g.weapons.length && (
              <button type="button" className="btn btn--small" onClick={() => set(g.key, (x) => ({ ...x, rows: [...x.rows, { weapon: g.weapons.find((w) => !x.rows.some((y) => y.weapon === w))!, attacks: 1 }] }))}>
                Split attacks with another weapon
              </button>
            )}
            <label className="play-field">
              <span>Target</span>
              <select value={c.target} onChange={(e) => set(g.key, (x) => ({ ...x, target: e.target.value }))}>
                {g.targets.map((t) => (
                  <option key={t} value={t}>
                    {s.units[t].name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      })}
      <button type="button" className="btn btn--primary" onClick={fight}>
        Fight
      </button>
    </div>
  );
}

export function FightPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const a = s.activation?.kind === 'fight' ? s.activation : null;
  const run = (problems: Problem[] | null) => ui.setProblems(problems ?? []);
  useEffect(() => {
    if (!a) ui.setRings([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.stage]);

  if (a) {
    const name = s.units[a.unitId].name;
    const by = s.units[a.unitId].player;
    if (a.stage === 'pile-in')
      return (
        <section>
          <h2>{name}: pile in</h2>
          <PlanMove {...props} unitId={a.unitId} radius={3} ringKind="move" confirmLabel="Pile in" command={(moves) => ({ type: 'pileIn', by, unitId: a.unitId, moves })}>
            <button type="button" className="btn" onClick={() => run(sb.act({ type: 'pileIn', by, unitId: a.unitId, moves: {} }))}>
              Don't pile in
            </button>
          </PlanMove>
        </section>
      );
    if (a.stage === 'attacks')
      return (
        <section>
          <h2>{name}: attacks</h2>
          <Attacks {...props} unitId={a.unitId} />
        </section>
      );
    return (
      <section>
        <h2>{name}: consolidate</h2>
        {s.units[a.unitId].location === 'battlefield' ? (
          <PlanMove {...props} unitId={a.unitId} radius={3} ringKind="move" confirmLabel="Consolidate" command={(moves) => ({ type: 'consolidate', by, unitId: a.unitId, moves })}>
            <button type="button" className="btn" onClick={() => run(sb.act({ type: 'consolidate', by, unitId: a.unitId, moves: {} }))}>
              Don't consolidate
            </button>
          </PlanMove>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'consolidate', by, unitId: a.unitId, moves: {} }))}>
            Don't consolidate
          </button>
        )}
      </section>
    );
  }

  const order = fightOrder(s);
  return (
    <section>
      {order.selectable.length ? (
        <>
          <h2>{armyName(s, order.picker)} picks a unit to fight</h2>
          <UnitPicker units={order.selectable} state={s} selected={null} onPick={(id) => run(sb.act({ type: 'selectFighter', by: order.picker, unitId: id }))} label="Units that can fight now" />
        </>
      ) : (
        <h2>No units are left to fight</h2>
      )}
      <button type="button" className="btn btn--primary" onClick={() => run(sb.act({ type: 'endPhase', by: s.active }))}>
        End Fight phase
      </button>
    </section>
  );
}
