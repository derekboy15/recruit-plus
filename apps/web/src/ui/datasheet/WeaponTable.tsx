import type { ProfileOut } from '@recruit/data/model';
import { Fragment } from 'react';
import { useWording } from '../../rules/wording';
import type { SheetWeaponRow } from './sheetModel';

const COLS = ['Range', 'Type', 'S', 'AP', 'D'] as const;

/** A weapon profile's mode: "Plasma pistol, Supercharge" under "Plasma pistol" → "Supercharge". */
function modeOf(profile: ProfileOut, base: string): string {
  if (!profile.name.startsWith(base)) return profile.name;
  const rest = profile.name.slice(base.length).replace(/^[\s,–-]+/, '').trim();
  const paren = /^\((.*)\)$/.exec(rest);
  return (paren ? paren[1] : rest) || profile.name;
}

/**
 * Weapons as one table (spec §3, layout B): each weapon a row group named after it, with who carries it under its name,
 * a row per profile, and its special rule under the numbers (plain English or the official wording, as switched).
 */
export function WeaponTable({ rows }: { rows: SheetWeaponRow[] }) {
  const { wording } = useWording();
  if (!rows.length) return null;
  const rule = (p: ProfileOut) => {
    const text = (wording === 'plain' && p.plain?.Abilities) || p.chars.Abilities;
    return text && text.trim() !== '-' ? text : null;
  };
  return (
    <table className="ds-weapons">
      <thead>
        <tr>
          <th scope="col">Weapon</th>
          {COLS.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      {rows.map((r) => {
        const head = (
          <>
            <span className="ds-weapons__name">
              {r.name}
              {r.count !== undefined && r.count > 1 && <span className="ds-weapons__count">{` ×${r.count}`}</span>}
            </span>
            {r.carriedBy && <span className="ds-weapons__who">{r.carriedBy}</span>}
          </>
        );
        return (
          <tbody key={`${r.name}|${r.carriedBy}`} aria-label={r.name}>
            {r.profiles.length > 1 && (
              <tr>
                <th scope="rowgroup" colSpan={COLS.length + 1} className="ds-weapons__group">
                  {head}
                </th>
              </tr>
            )}
            {r.profiles.map((p) => (
              <Fragment key={p.name}>
                <tr>
                  <th scope="row">{r.profiles.length > 1 ? <span className="ds-weapons__mode">{modeOf(p, r.name)}</span> : head}</th>
                  {COLS.map((c) => (
                    <td key={c}>{p.chars[c]?.trim() || '-'}</td>
                  ))}
                </tr>
                {rule(p) && (
                  <tr className="ds-weapons__rule">
                    <td colSpan={COLS.length + 1}>{rule(p)}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        );
      })}
    </table>
  );
}
