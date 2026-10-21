/**
 * A unit's options from childOptions: radio cards for pick-one groups, checkboxes for 0–1 options, steppers for
 * anything that can be taken more than once (model stacks included). Options on a chosen model or item (a sergeant's
 * weapons) are shown under it, one block per stack.
 */
import { displayName, findSelView, type OptionNode, type RosterView, type Scope } from '@recruit/data/roster';
import { cleanLabel } from './labels';
import { fmt, hasChoices, leaves } from './editorView';
import type { EditorAction } from './useRosterEditor';

export interface OptionCtx {
  scope: Scope;
  view: RosterView;
  dispatch: (a: EditorAction) => unknown;
  /** childOptions for a selection, cached per roster. */
  optionsOf: (selId: string) => OptionNode[];
}
/** room: how many more the enclosing groups allow; spare: how many fewer. */
interface ListProps { ctx: OptionCtx; selId: string; nodes: OptionNode[]; room: number; spare: number; depth: number }
type ControlProps = Omit<ListProps, 'nodes'>;

const MAX_DEPTH = 4;
const cost = (o: OptionNode) => (o.pointsEach > 0 ? <span className="opt__pts">+{fmt(o.pointsEach)} pts</span> : null);
const isFixed = (o: OptionNode) => o.kind === 'option' && o.min === o.max && o.count === o.min;
const countOf = (ctx: OptionCtx, selId: string) => findSelView(ctx.view, selId)?.sel.count ?? 0;

export function OptionList({ nodes, ...props }: ListProps) {
  const { ctx } = props;
  const included = nodes.filter((n) => isFixed(n) && !n.selIds.some((id) => hasChoices(ctx.optionsOf(id))));
  return (
    <>
      {included.length > 0 && <p className="muted opt__included">Comes with: {included.map((n) => displayName(n.name)).join(', ')}</p>}
      {nodes.map((n) => {
        if (included.includes(n)) return null;
        if (n.kind === 'group') return <GroupControl key={n.id} {...props} group={n} />;
        return <OptionControl key={n.id} {...props} option={n} />;
      })}
    </>
  );
}

function GroupControl({ ctx, selId, group, room, spare, depth }: ControlProps & { group: OptionNode }) {
  const label = cleanLabel(group.name) || 'Choose';
  const options = leaves(group.children);
  if (group.max === 1 && options.length > 1) {
    const chosen = options.filter((o) => o.count > 0);
    return (
      <fieldset className="choices">
        <legend>{label}</legend>
        {group.min > 0 && chosen.length === 0 && <p className="hint">Pick one.</p>}
        {group.min === 0 && (
          <label className="radio-card">
            <input
              type="radio"
              name={`${selId}:${group.id}`}
              checked={chosen.length === 0}
              onChange={() => chosen.flatMap((o) => o.selIds).forEach((id) => ctx.dispatch({ type: 'remove', selId: id }))}
            />
            <span className="radio-card__name">None</span>
          </label>
        )}
        {options.map((o) => (
          <label key={o.id} className="radio-card">
            <input
              type="radio"
              name={`${selId}:${group.id}`}
              checked={o.count > 0}
              onChange={() => ctx.dispatch({ type: 'choose', parentSelId: selId, groupId: group.id, entryId: o.id })}
            />
            <span className="radio-card__name">{displayName(o.name)}</span>
            {cost(o)}
          </label>
        ))}
        {chosen.map((o) => <Nested key={o.id} ctx={ctx} option={o} depth={depth} />)}
      </fieldset>
    );
  }
  const limit = group.max === -1 ? Infinity : group.max - group.count;
  const range = group.min === group.max ? `${group.min}` : group.max === -1 ? `${group.min}+` : `${group.min}–${group.max}`;
  return (
    <fieldset className="choices">
      <legend>{label}</legend>
      {(group.min > 0 || group.max !== -1) && <p className="muted opt__range">{`Take ${range} · ${fmt(group.count)} chosen`}</p>}
      <OptionList
        ctx={ctx}
        selId={selId}
        nodes={group.children}
        room={Math.min(room, limit)}
        spare={Math.min(spare, group.count - group.min)}
        depth={depth}
      />
    </fieldset>
  );
}

function OptionControl({ ctx, selId, option: o, room, spare, depth }: ControlProps & { option: OptionNode }) {
  const full = o.max !== -1 && o.count >= o.max;
  const add = () => ctx.dispatch({ type: 'add-child', parentSelId: selId, entryId: o.id });
  // Always exactly this many (a squad's one sergeant): only its own options are shown.
  if (isFixed(o)) return <Nested ctx={ctx} option={o} depth={depth} />;
  if (o.max === 1) {
    const on = o.count > 0;
    return (
      <div>
        <label className="opt">
          <input
            type="checkbox"
            checked={on}
            disabled={on ? o.min >= 1 || spare <= 0 : room <= 0}
            onChange={() => (on ? o.selIds.forEach((id) => ctx.dispatch({ type: 'remove', selId: id })) : add())}
          />
          <span className="opt__name">{displayName(o.name)}</span>
          {cost(o)}
        </label>
        <Nested ctx={ctx} option={o} depth={depth} />
      </div>
    );
  }
  // "+" grows the first stack. "−" takes one from the first stack with more than one copy, so a model set apart with
  // "Customise one" is never dropped by the stepper; when every stack is a single copy, each is removed with its own
  // Remove button (a lone stack is simply taken away).
  const first = o.selIds[0];
  const shrinkable = o.selIds.length === 1 ? first : o.selIds.find((id) => countOf(ctx, id) > 1);
  const grow = () => (first ? ctx.dispatch({ type: 'set-count', selId: first, count: countOf(ctx, first) + 1 }) : add());
  const shrink = () => shrinkable && ctx.dispatch({ type: 'set-count', selId: shrinkable, count: countOf(ctx, shrinkable) - 1 });
  return (
    <div>
      <div className="opt">
        <span className="opt__name">
          {displayName(o.name)}
          {cost(o)}
        </span>
        <span className="stepper">
          <button type="button" aria-label={`Remove one ${displayName(o.name)}`} disabled={o.count <= o.min || spare <= 0 || !shrinkable} onClick={shrink}>
            −
          </button>
          <output>{fmt(o.count)}</output>
          <button type="button" aria-label={`Add one ${displayName(o.name)}`} disabled={full || room <= 0} onClick={grow}>
            +
          </button>
        </span>
      </div>
      <Nested ctx={ctx} option={o} depth={depth} />
    </div>
  );
}

/** One block per stack of a chosen option that has options of its own. */
function Nested({ ctx, option, depth }: { ctx: OptionCtx; option: OptionNode; depth: number }) {
  if (depth >= MAX_DEPTH) return null;
  return (
    <>
      {option.selIds.map((id) => {
        const nodes = ctx.optionsOf(id);
        if (!hasChoices(nodes)) return null;
        return <StackBlock key={id} ctx={ctx} selId={id} nodes={nodes} removable={option.selIds.length > 1} depth={depth + 1} />;
      })}
    </>
  );
}

/** One stack of a chosen option. `removable`: the option has several stacks, so each can be taken out on its own. */
function StackBlock({ ctx, selId, nodes, removable, depth }: { ctx: OptionCtx; selId: string; nodes: OptionNode[]; removable: boolean; depth: number }) {
  const v = findSelView(ctx.view, selId);
  if (!v) return null;
  const n = v.sel.count;
  const name = displayName(v.name);
  return (
    <div className="stack">
      <div className="stack__head">
        <strong>{n > 1 ? `${name} ×${fmt(n)}` : name}</strong>
        {n > 1 && (
          <button type="button" className="btn btn--small" onClick={() => ctx.dispatch({ type: 'split', selId })}>
            {v.type === 'model' ? 'Customise one model' : 'Customise one'}
          </button>
        )}
        {removable && (
          <button type="button" className="btn btn--small" aria-label={n === 1 ? `Remove this ${name}` : `Remove these ${fmt(n)} ${name}`} onClick={() => ctx.dispatch({ type: 'remove', selId })}>
            Remove
          </button>
        )}
      </div>
      {n > 1 && <p className="muted opt__range">These options apply to all {fmt(n)}.</p>}
      <OptionList ctx={ctx} selId={selId} nodes={nodes} room={Infinity} spare={Infinity} depth={depth} />
    </div>
  );
}
