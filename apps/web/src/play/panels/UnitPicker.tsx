import { livingModels, sheetOf, type GameState } from '@recruit/engine';

const baseText = (s: GameState, unitId: string) => {
  const b = sheetOf(s, unitId).base;
  return b.kind === 'circle' ? `${Math.round(b.d * 25.4)}mm` : `${Math.round(b.w * 25.4)}×${Math.round(b.h * 25.4)}mm`;
};

/** A list of units to pick from, with model counts and base sizes. */
export function UnitPicker({ units, state, selected, onPick, label }: { units: string[]; state: GameState; selected: string | null; onPick(id: string): void; label: string }) {
  if (!units.length) return null;
  return (
    <ul className="list play-units" aria-label={label}>
      {units.map((id) => {
        const n = livingModels(state, id).length;
        return (
          <li key={id}>
            <button type="button" className="list__link play-unit" aria-pressed={selected === id} onClick={() => onPick(id)}>
              <span className="list__main">
                <strong>{state.units[id].name}</strong>
                <span className="muted">
                  {n} {n === 1 ? 'model' : 'models'} · {baseText(state, id)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
