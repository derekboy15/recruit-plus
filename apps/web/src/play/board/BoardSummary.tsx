/**
 * What the board shows, in words, for screen readers: a visually hidden description (the board's aria-describedby)
 * and a polite live line for the model in keyboard focus.
 */
import type { PlayerId } from '@recruit/engine';
import type { BoardScene } from './scene';

export interface BoardNames {
  unit(unitId: string): string;
  army(player: PlayerId): string;
  /** The label shown on the board for an objective; its id by default. */
  objective?(id: string): string;
}

export const DEFAULT_NAMES: BoardNames = { unit: (id) => id, army: (p) => `Player ${p}` };

/** Rounded to the nearest half inch, as a player would read a tape measure. */
export const inches = (v: number) => String(Math.round(v * 2) / 2);

export function describeModel(scene: BoardScene, modelId: string, names: BoardNames, opts: { grabbed?: boolean } = {}): string {
  const m = scene.models.find((x) => x.id === modelId);
  if (!m) return '';
  const index = scene.models.filter((x) => x.unitId === m.unitId).indexOf(m) + 1;
  return `${names.unit(m.unitId)}, model ${index}${opts.grabbed ? ', picked up' : ''}: ${inches(m.center.x)} inches from the left, ${inches(m.center.y)} inches from the bottom`;
}

export function describeBoard(scene: BoardScene, names: BoardNames): string[] {
  const lines = [`Battlefield, ${scene.board.w} by ${scene.board.h} inches.`];
  for (const z of scene.zones) lines.push(`${names.army(z.player)} deployment zone.`);
  for (const o of scene.objectives) {
    const name = names.objective?.(o.id) ?? o.id;
    lines.push(`Objective ${name}: ${o.owner ? `held by ${names.army(o.owner)}` : 'no one holds it'}.`);
  }
  const units = new Map<string, { player: PlayerId; count: number; selected: boolean; target: boolean }>();
  for (const m of scene.models) {
    const u = units.get(m.unitId) ?? { player: m.player, count: 0, selected: false, target: false };
    units.set(m.unitId, { ...u, count: u.count + 1, selected: u.selected || m.selected, target: u.target || m.target });
  }
  for (const [unitId, u] of units) {
    const marks = [u.selected && 'selected', u.target && 'target'].filter(Boolean).join(', ');
    lines.push(`${names.unit(unitId)} (${names.army(u.player)}): ${u.count} model${u.count === 1 ? '' : 's'}${marks ? `, ${marks}` : ''}.`);
  }
  lines.push('Keys: arrows move the view, ] and [ step through models, Enter selects, Space picks a model up to move it.');
  return lines;
}

export function BoardSummary({ id, scene, names, live }: { id: string; scene: BoardScene; names: BoardNames; live: string }) {
  return (
    <>
      <div id={id} className="sr-only">
        {describeBoard(scene, names).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
    </>
  );
}
