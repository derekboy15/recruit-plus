/**
 * The manual-adjust toolkit (spec §3.3): for rules that change the flow of the game (Reanimation Protocols, Cult Ambush,
 * Miracle dice…) without per-faction code. Every tool is one engine command: logged, and undoable within the phase (R-19).
 * It replaces the phase panel while open, so the board stays free for picking models and places.
 */
import { charsOf, livingModels, objectiveName, profileOf, sheetOf, type ActivationKind, type Command, type PlayerId, type Pos, type Problem } from '@recruit/engine';
import { useEffect, useRef, useState } from 'react';
import { armyName } from '../game/names';
import type { PanelProps } from '../panels/types';
import { TurnButtons } from '../panels/TurnButtons';
import { UnitPicker } from '../panels/UnitPicker';

type Tool = 'move' | 'remove' | 'return' | 'add' | 'wounds' | 'die' | 'extra' | 'cp' | 'vp' | 'objectives' | 'order' | 'flags';
const TOOLS: [Tool, string, string][] = [
  ['move', 'Move a model by hand', 'Put a model anywhere, e.g. for a redeploy.'],
  ['remove', 'Remove a model', 'Take a model off, destroyed or not.'],
  ['return', 'Return a destroyed model', 'For rules like Reanimation Protocols.'],
  ['add', 'Add a model', 'For rules that add models to a unit.'],
  ['wounds', 'Set wounds left', 'Heal or wound a model by hand.'],
  ['die', 'Change a die', 'Change a die of the roll in progress.'],
  ['extra', 'Extra activation', 'Let a unit move, shoot, charge, fight or manifest again.'],
  ['cp', 'Command Points', 'Spend or gain CP for an ability.'],
  ['vp', 'Victory Points', 'Correct either army’s VP.'],
  ['objectives', 'Objectives', 'Give an objective to a player (or nobody).'],
  ['order', 'Casualty order', 'Which models are removed first.'],
  ['flags', 'Unit rules', 'Counts as Remained Stationary, Objective Secured.'],
];
const EXTRA: [ActivationKind, string][] = [
  ['move', 'Move again'],
  ['psychic', 'Psychic again'],
  ['shoot', 'Shoot again'],
  ['charge', 'Charge again'],
  ['fight', 'Fight again'],
];

export function Toolkit(props: PanelProps & { onClose(): void }) {
  const { sb, ui, onClose } = props;
  const s = sb.state;
  const [tool, setTool] = useState<Tool | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [spot, setSpot] = useState<Pos | null>(null);
  const [unitId, setUnitId] = useState<string | null>(ui.selectedUnitId);
  const [counts, setCounts] = useState(false);
  const [wounds, setWounds] = useState(1);
  const [profile, setProfile] = useState('');
  const [order, setOrder] = useState<string[]>([]);

  const reset = () => {
    setModelId(null);
    setSpot(null);
    if (ownPlan.current) ui.planDispatch({ type: 'clear' });
    ownPlan.current = false;
    ui.setInvalid([]);
  };
  const run = (cmd: Command) => {
    const problems = sb.act(cmd) as Problem[] | null;
    ui.setProblems(problems ?? []);
    if (!problems) reset();
    return !problems;
  };
  const owner = (id: string): PlayerId => s.units[id].player;

  // Board taps: pick a model, or a place.
  useEffect(() => {
    ui.setTapHandler((at, id) => {
      if (tool === 'move' || tool === 'remove' || tool === 'wounds') {
        if (!id) return;
        setModelId(id);
        const m = s.models[id];
        if (tool === 'move') {
          ownPlan.current = true;
          ui.planDispatch({ type: 'start', unitId: m.unitId, origin: { [id]: m.pos }, together: false });
        }
        if (tool === 'wounds') setWounds(m.woundsLeft);
        return;
      }
      if (tool === 'return' || tool === 'add') return setSpot({ x: at.x, y: at.y, z: 0, rot: 0 });
      if (id) setUnitId(s.models[id].unitId);
    });
    return () => ui.setTapHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, s]);
  // Clears only a plan the toolkit started itself (a model moved by hand), never a move in progress.
  const ownPlan = useRef(false);
  useEffect(() => () => void (ownPlan.current && ui.planDispatch({ type: 'clear' })), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (unitId && s.units[unitId]) setOrder(s.units[unitId].casualtyOrder.filter((id) => !s.models[id].destroyed));
    const ds = unitId && s.units[unitId] ? sheetOf(s, unitId) : null;
    setProfile(ds?.models[0]?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const allUnits = Object.values(s.units).filter((u) => u.location !== 'reserves' && u.location !== 'embarked').map((u) => u.id);
  const pickUnit = (label: string) => (
    <UnitPicker units={allUnits} state={s} selected={unitId} onPick={(id) => (setUnitId(id), ui.select(id))} label={label} />
  );
  const model = modelId ? s.models[modelId] : null;
  const modelName = (id: string) => `${s.models[id].profile} (model ${s.units[s.models[id].unitId].modelIds.indexOf(id) + 1})`;

  let body: React.ReactNode = null;
  switch (tool) {
    case 'move':
      body = model ? (
        <>
          <p>Drag {modelName(model.id)} of {s.units[model.unitId].name} where it should go.</p>
          <TurnButtons ui={ui} modelId={model.id} />
          <button type="button" className="btn btn--primary" onClick={() => ui.plan?.positions[model.id] && run({ type: 'placeModel', by: owner(model.unitId), modelId: model.id, pos: ui.plan.positions[model.id] })}>
            Put it here
          </button>
        </>
      ) : (
        <p className="muted">Tap the model to move.</p>
      );
      break;
    case 'remove':
      body = model ? (
        <>
          <p>
            Remove {modelName(model.id)} of {s.units[model.unitId].name}:
          </p>
          <div className="play-row">
            <button type="button" className="btn" onClick={() => run({ type: 'removeModel', by: owner(model.unitId), modelId: model.id, destroyed: true })}>
              Destroyed
            </button>
            <button type="button" className="btn" onClick={() => run({ type: 'removeModel', by: owner(model.unitId), modelId: model.id, destroyed: false })}>
              Removed (not destroyed)
            </button>
          </div>
        </>
      ) : (
        <p className="muted">Tap the model to remove.</p>
      );
      break;
    case 'return': {
      const dead = unitId ? s.units[unitId].modelIds.filter((id) => s.models[id].destroyed) : [];
      body = (
        <>
          {pickUnit('Unit')}
          {unitId && !dead.length && <p className="muted">No model of {s.units[unitId].name} has been destroyed.</p>}
          <div className="play-chips">
            {dead.map((id) => (
              <button key={id} type="button" className="btn btn--small" aria-pressed={modelId === id} onClick={() => setModelId(id)}>
                {modelName(id)}
              </button>
            ))}
          </div>
          {modelId && <p className="muted">{spot ? `Here: ${spot.x.toFixed(1)}", ${spot.y.toFixed(1)}"` : 'Tap the board where it goes.'}</p>}
          <label className="choices__option">
            <input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} />
            <span>Still counts as destroyed for this turn's Morale test</span>
          </label>
          <button type="button" className="btn btn--primary" disabled={!modelId || !spot} onClick={() => modelId && spot && run({ type: 'returnModel', by: owner(s.models[modelId].unitId), modelId, pos: spot, countsAsDestroyed: counts })}>
            Return it here
          </button>
        </>
      );
      break;
    }
    case 'add': {
      const ds = unitId ? sheetOf(s, unitId) : null;
      const like = unitId ? livingModels(s, unitId).find((m) => m.profile === profile) : null;
      body = (
        <>
          {pickUnit('Unit')}
          {ds && (
            <label className="play-field">
              <span>Model</span>
              <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                {ds.models.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {ds && <p className="muted">{spot ? 'Placed. ' : 'Tap the board where it goes. '}It gets the same wargear as the unit's other {profile} models.</p>}
          <button
            type="button"
            className="btn btn--primary"
            disabled={!unitId || !spot || !profile}
            onClick={() => unitId && spot && run({ type: 'addModel', by: owner(unitId), unitId, profile, weapons: like?.weapons ?? [], pos: spot })}
          >
            Add it here
          </button>
        </>
      );
      break;
    }
    case 'wounds': {
      const W = model ? profileOf(s, model).chars.W : 1;
      body = model ? (
        <>
          <p>
            {modelName(model.id)} of {s.units[model.unitId].name}: {model.woundsLeft} of {W} wounds left (it now fights as W {charsOf(s, model).W}).
          </p>
          <div className="play-row">
            <button type="button" className="btn btn--small" aria-label="Fewer wounds" onClick={() => setWounds((w) => Math.max(1, w - 1))}>
              −
            </button>
            <span className="play-count">{wounds}</span>
            <button type="button" className="btn btn--small" aria-label="More wounds" onClick={() => setWounds((w) => Math.min(W, w + 1))}>
              +
            </button>
            <button type="button" className="btn" onClick={() => run({ type: 'setWounds', by: owner(model.unitId), modelId: model.id, woundsLeft: wounds })}>
              Set {wounds} {wounds === 1 ? 'wound' : 'wounds'} left
            </button>
          </div>
        </>
      ) : (
        <p className="muted">Tap the model.</p>
      );
      break;
    }
    case 'die':
      body = <p className="muted">{s.pending?.kind === 'roll' ? 'Pick the die on the roll itself and choose "Change a die…".' : 'There is no roll in progress.'}</p>;
      break;
    case 'extra':
      body = (
        <>
          {pickUnit('Unit')}
          {unitId && (
            <div className="play-chips">
              {EXTRA.map(([kind, label]) => (
                <button key={kind} type="button" className="btn btn--small" onClick={() => run({ type: 'extraActivation', by: owner(unitId), unitId, kind })}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      );
      break;
    case 'cp':
      body = (['A', 'B'] as PlayerId[]).map((p) => (
        <div key={p} className="play-row">
          <span className="play-grow">
            {armyName(s, p)}: {s.cp[p]} CP
          </span>
          <button type="button" className="btn btn--small" aria-label={`${armyName(s, p)} −1 CP`} onClick={() => run({ type: 'adjustCp', by: p, player: p, delta: -1 })}>
            −1
          </button>
          <button type="button" className="btn btn--small" aria-label={`${armyName(s, p)} +1 CP`} onClick={() => run({ type: 'adjustCp', by: p, player: p, delta: 1 })}>
            +1
          </button>
        </div>
      ));
      break;
    case 'vp':
      body = (['A', 'B'] as PlayerId[]).map((p) => (
        <div key={p}>
          <p>{armyName(s, p)}</p>
          {(['primary', 'secondary', 'painted'] as const).map((category) => (
            <div key={category} className="play-row">
              <span className="play-grow">{category[0].toUpperCase() + category.slice(1)}</span>
              {[-1, 1].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  className="btn btn--small"
                  aria-label={`${armyName(s, p)} ${category} ${delta > 0 ? '+1' : '−1'} VP`}
                  onClick={() => run({ type: 'adjustVp', by: p, player: p, category, delta, ...(category === 'secondary' ? { name: 'Adjusted by hand' } : {}) })}
                >
                  {delta > 0 ? '+1' : '−1'}
                </button>
              ))}
            </div>
          ))}
        </div>
      ));
      break;
    case 'objectives':
      body = s.setup.objectives.map((o) => {
        const cur = s.objectives[o.id];
        return (
          <div key={o.id} className="play-row">
            <label className="play-field play-grow">
              <span>Objective {objectiveName(o)}</span>
              <select
                aria-label={`Objective ${objectiveName(o)} held by`}
                value={cur?.owner ?? ''}
                onChange={(e) => run({ type: 'setObjective', by: s.active, objectiveId: o.id, owner: (e.target.value || null) as PlayerId | null, sticky: cur?.sticky ?? false })}
              >
                <option value="">Nobody (by models)</option>
                <option value="A">{armyName(s, 'A')}</option>
                <option value="B">{armyName(s, 'B')}</option>
              </select>
            </label>
            <label className="choices__option">
              <input type="checkbox" checked={cur?.sticky ?? false} onChange={(e) => run({ type: 'setObjective', by: s.active, objectiveId: o.id, owner: cur?.owner ?? null, sticky: e.target.checked })} />
              <span>Held until taken</span>
            </label>
          </div>
        );
      });
      break;
    case 'order':
      body = (
        <>
          {pickUnit('Unit')}
          {unitId && (
            <>
              <ol className="play-order">
                {order.map((id, i) => (
                  <li key={id} className="play-row">
                    <span className="play-grow">{modelName(id)}</span>
                    <button type="button" className="btn btn--small" aria-label={`Move ${modelName(id)} up`} disabled={i === 0} onClick={() => setOrder((o) => [...o.slice(0, i - 1), o[i], o[i - 1], ...o.slice(i + 1)])}>
                      ↑
                    </button>
                    <button type="button" className="btn btn--small" aria-label={`Move ${modelName(id)} down`} disabled={i === order.length - 1} onClick={() => setOrder((o) => [...o.slice(0, i), o[i + 1], o[i], ...o.slice(i + 2)])}>
                      ↓
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn btn--primary" onClick={() => run({ type: 'setCasualtyOrder', by: owner(unitId), unitId, modelIds: order })}>
                Save the order (first is removed first)
              </button>
            </>
          )}
        </>
      );
      break;
    case 'flags':
      body = (
        <>
          {pickUnit('Unit')}
          {unitId && (
            <>
              <label className="choices__option">
                <input
                  type="checkbox"
                  checked={!!s.units[unitId].flags.countsAsStationary}
                  onChange={(e) => run({ type: 'setUnitFlag', by: owner(unitId), unitId, flag: 'counts-as-stationary', value: e.target.checked })}
                />
                <span>Counts as having Remained Stationary this turn</span>
              </label>
              <label className="choices__option">
                <input
                  type="checkbox"
                  checked={s.units[unitId].flags.objectiveSecured ?? sheetOf(s, unitId).objectiveSecured}
                  onChange={(e) => run({ type: 'setUnitFlag', by: owner(unitId), unitId, flag: 'objective-secured', value: e.target.checked })}
                />
                <span>Objective Secured</span>
              </label>
            </>
          )}
        </>
      );
      break;
  }

  return (
    <section className="play-toolkit">
      <h2>Toolkit</h2>
      <p className="muted play-small">For rules the app doesn't run itself. Every change is logged and can be undone.</p>
      {!tool ? (
        <div className="play-tools">
          {TOOLS.map(([id, name, blurb]) => (
            <button key={id} type="button" className="list__link play-unit" aria-label={name} aria-describedby={`tool-${id}`} onClick={() => (reset(), setTool(id))}>
              <span className="list__main">
                <strong>{name}</strong>
                <span className="muted" id={`tool-${id}`}>
                  {blurb}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <h3>{TOOLS.find(([id]) => id === tool)![1]}</h3>
          {body}
          <button type="button" className="btn" onClick={() => (reset(), setTool(null))}>
            Other tools
          </button>
        </>
      )}
      <button type="button" className="btn" onClick={onClose}>
        Close the toolkit
      </button>
    </section>
  );
}
