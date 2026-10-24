import { useId, useState, type KeyboardEvent } from 'react';
import type { BoardNames } from '../board/BoardSummary';
import { TERRAIN_COLOURS, TERRAIN_NAMES } from '../board/colours';
import type { BoardScene } from '../board/scene';

const ZONE_COLOURS = { A: 'var(--brass)', B: 'var(--red-strong)' } as const;

/** "Objectives 1–4", or by name when the mission has real labels ("Objectives North, Centre, South"). */
function objectivesText(names: string[]): string | null {
  if (!names.length) return null;
  if (names.length === 1) return `Objective ${names[0]}: hold within 3"`;
  const numbered = names.every((n, i) => n === String(i + 1));
  return `Objectives ${numbered ? `${names[0]}–${names[names.length - 1]}` : names.join(', ')}: hold within 3"`;
}

/** A toggle over the board's corner that explains the map: whose zone is whose, what each terrain look is, and objectives. */
export function MapKey({ scene, names }: { scene: BoardScene; names: BoardNames }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const looks = [...new Set(scene.terrain.map((t) => t.look))];
  const objectives = objectivesText(scene.objectives.map((o) => o.name));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    e.currentTarget.querySelector<HTMLButtonElement>('.map-key__toggle')?.focus();
  };
  return (
    <div className="map-key" onKeyDown={onKeyDown}>
      <button type="button" className="btn btn--small map-key__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        Map key
      </button>
      {open && (
        <div id={id} role="region" aria-label="Map key" className="map-key__panel">
          <ul className="map-key__list">
            {scene.zones.map((z) => (
              <li key={z.player}>
                <span className="map-key__swatch map-key__swatch--zone" style={{ borderColor: ZONE_COLOURS[z.player] }} aria-hidden="true" />
                {`${names.army(z.player)} deployment zone`}
              </li>
            ))}
            {looks.map((look) => (
              <li key={look}>
                <span className="map-key__swatch" style={{ background: TERRAIN_COLOURS[look] }} aria-hidden="true" />
                {TERRAIN_NAMES[look]}
              </li>
            ))}
            {objectives && (
              <li>
                <span className="map-key__swatch map-key__swatch--objective" aria-hidden="true" />
                {objectives}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
