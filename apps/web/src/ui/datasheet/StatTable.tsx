import { STAT_KEYS } from './StatGrid';
import type { SheetStatRow } from './sheetModel';

/**
 * The unit's stat lines as one table, each model's name on its own full-width row above its numbers, so nine columns
 * fit a phone and every line says whose it is (spec §3, layout B). Each model is a row group named "… characteristics".
 */
export function StatTable({ rows }: { rows: SheetStatRow[] }) {
  if (!rows.length) return null;
  return (
    <table className="ds-stats">
      <thead>
        <tr>
          {STAT_KEYS.map(([label]) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      {rows.map((r) => (
        <tbody key={r.label} aria-label={`${r.label} characteristics`}>
          <tr>
            <th scope="rowgroup" colSpan={STAT_KEYS.length} className="ds-stats__model">
              {r.label}
              {r.count !== undefined && <span className="ds-stats__count">{` ×${r.count}`}</span>}
            </th>
          </tr>
          <tr>
            {STAT_KEYS.map(([label, key]) => (
              <td key={label}>{r.profile.chars[key]?.trim() || '-'}</td>
            ))}
          </tr>
        </tbody>
      ))}
    </table>
  );
}
