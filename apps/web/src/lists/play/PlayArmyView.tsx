/** Play mode's army: two tiles (army rules, stratagems), then every unit by role. Tapping one asks for its sheet. */
import { useId } from 'react';
import { IconNext, IconRules, IconTable, IconWarlord } from '../../ui/icons';
import { keyStats } from '../../ui/datasheet';
import { fmt } from '../editorView';
import type { PlayData } from './loadPlayData';
import type { PlayUnit } from './playArmy';
import './play-mode.css';

/** The one sheet Play mode can have open. */
export type PlaySheet = { kind: 'rules' } | { kind: 'stratagems' } | { kind: 'unit'; selId: string };

/** M, T, Sv, the invulnerable save when it has one, and W. */
function UnitStats({ unit }: { unit: NonNullable<PlayUnit['unit']> }) {
  const k = keyStats(unit);
  const stats: [string, string][] = [['M', k.M], ['T', k.T], ['Sv', k.Sv], ...(k.inv ? [['Inv', k.inv] as [string, string]] : []), ['W', k.W]];
  return (
    <dl className="play-unit__stats">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function UnitCard({ u, onOpen }: { u: PlayUnit; onOpen: (s: PlaySheet) => void }) {
  return (
    <button type="button" className="play-unit" onClick={() => onOpen({ kind: 'unit', selId: u.selId })}>
      <span className="play-unit__main">
        <span className="play-unit__name">
          {u.name}
          {u.models > 1 && <span className="play-unit__models">{` · ${fmt(u.models)}`}</span>}
          {u.warlord && (
            <span className="play-unit__warlord">
              <IconWarlord size={13} aria-hidden="true" />
              {u.warlordTrait ? `Warlord · ${u.warlordTrait}` : 'Warlord'}
            </span>
          )}
        </span>
        {u.unit && <UnitStats unit={u.unit} />}
        {u.wargear.length > 0 && <span className="play-unit__gear">{u.wargear.join(' · ')}</span>}
      </span>
      <span className="play-unit__pts">{`${fmt(u.points)} pts`}</span>
      <IconNext className="play-unit__go" size={18} aria-hidden="true" />
    </button>
  );
}

function RoleSection({ role, units, onOpen }: { role: string; units: PlayUnit[]; onOpen: (s: PlaySheet) => void }) {
  const id = useId();
  return (
    <section className="play-role" aria-labelledby={id}>
      <h2 id={id} className="play-role__title label-caps">
        {role}
      </h2>
      <ul className="play-units">
        {units.map((u) => (
          <li key={u.selId}>
            <UnitCard u={u} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Page content, read only: nothing here edits the list. The sheets it asks for are PlaySheets'. */
export function PlayArmyView({ data, onOpen }: { data: PlayData; onOpen: (s: PlaySheet) => void }) {
  const { army, rules } = data;
  const ruleNames = rules.slice(0, 3).map((r) => r.name).join(', ');
  return (
    <div className="play">
      <div className="play__tiles">
        <button type="button" className="play-tile" onClick={() => onOpen({ kind: 'rules' })}>
          <span className="play-tile__title">
            <IconRules size={16} aria-hidden="true" />
            Army rules
          </span>
          {ruleNames && <span className="play-tile__sub">{ruleNames}</span>}
        </button>
        <button type="button" className="play-tile" onClick={() => onOpen({ kind: 'stratagems' })}>
          <span className="play-tile__title">
            <IconTable size={16} aria-hidden="true" />
            Stratagems
          </span>
          <span className="play-tile__sub">Yours and core ones, by phase</span>
        </button>
      </div>
      {army.roles.length === 0 && <p className="muted">No units in this list yet.</p>}
      {army.roles.map((r) => (
        <RoleSection key={r.role} role={r.role} units={r.units} onOpen={onOpen} />
      ))}
    </div>
  );
}
