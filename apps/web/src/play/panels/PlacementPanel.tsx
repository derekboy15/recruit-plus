/** A transport was destroyed with units inside: its owner sets them up near where it was (or uses Emergency Disembarkation). */
import { livingModels, sheetOf, type Command, type Pos, type Problem } from '@recruit/engine';
import { useEffect, useState } from 'react';
import { formation } from '../board/formation';
import { toPositions } from '../game/plan';
import { armyName } from '../game/names';
import { unplacedOrigin } from './boardHelpers';
import { Problems } from './Problems';
import { TurnButtons } from './TurnButtons';
import type { PanelProps } from './types';
import { useDryRun } from './useDryRun';
import { PinAction } from '../game/actionBar';

export function PlacementPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const req = s.placements[0];
  const [kept, setKept] = useState<Record<string, Record<string, Pos>>>({});
  const [emergency, setEmergency] = useState(false);
  useEffect(() => () => ui.setTapHandler(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const current = ui.plan && req?.unitIds.includes(ui.plan.unitId) ? ui.plan : null;
  const ready = current && Object.keys(current.positions).length === livingModels(s, current.unitId).length;
  // Checked on its own with the units already kept, so the engine judges this unit's spot.
  const cmd: Command | null =
    req && ready ? { type: 'placePassengers', by: req.player, transportId: req.transportId, placements: { ...kept, [current!.unitId]: toPositions(current!) }, emergency } : null;
  const dry = useDryRun(props, cmd);
  const unitProblems = (dry ?? []).filter((p) => !p.unitId || p.unitId === current?.unitId);
  if (!req) return null;

  const pick = (id: string) => {
    const models = livingModels(s, id);
    const base = sheetOf(s, id).base;
    ui.planDispatch({ type: 'start', unitId: id, origin: unplacedOrigin(models.map((m) => m.id)) });
    ui.setTapHandler((at) => ui.planDispatch({ type: 'place', positions: formation(models.map((m) => ({ id: m.id, base })), at, undefined, 4, 0.5) }));
  };
  const keep = () => {
    if (!current) return;
    setKept((k) => ({ ...k, [current.unitId]: toPositions(current) }));
    ui.planDispatch({ type: 'clear' });
    ui.setTapHandler(null);
  };
  const finish = () => {
    const problems = sb.act({ type: 'placePassengers', by: req.player, transportId: req.transportId, placements: kept, emergency }) as Problem[] | null;
    ui.setProblems(problems ?? []);
    if (!problems) setKept({});
  };
  const transport = s.units[req.transportId].name;

  return (
    <section>
      <h2>{transport} was destroyed</h2>
      <p>
        {armyName(s, req.player)}: set up the units that were inside wholly within {emergency ? 6 : 3}" of where it was. Each model set up dies on a roll of{' '}
        {emergency ? '1–2' : '1'}; models you can't set up are destroyed.
      </p>
      <ul className="list">
        {req.unitIds.map((id) => (
          <li key={id}>
            <button type="button" className="list__link play-unit" aria-pressed={current?.unitId === id} onClick={() => pick(id)}>
              {s.units[id].name} {kept[id] ? '(set up)' : ''}
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <>
          {!ready && <p className="muted">Tap where {s.units[current.unitId].name} gets out.</p>}
          {ready && <TurnButtons ui={ui} />}
          {dry && <Problems problems={unitProblems} />}
          <button type="button" className="btn" disabled={!dry || unitProblems.length > 0} onClick={keep}>
            Keep {s.units[current.unitId].name} here
          </button>
        </>
      )}
      <label className="choices__option">
        <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />
        <span>Emergency Disembarkation (1 CP): within 6", but each model dies on a 1–2</span>
      </label>
      <PinAction slot="main">
        <button type="button" className="btn btn--primary" onClick={finish}>
          Set them up
        </button>
      </PinAction>
    </section>
  );
}
