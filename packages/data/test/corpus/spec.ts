/**
 * Known-legal / known-illegal roster corpus: list specs written by hand from the rules and an independent points
 * source (the Wahapedia snapshot), and buildFromSpec, which turns a spec into a Roster through the public engine API.
 * Everything is found by its effective name (trimmed); a name that matches nothing, or more than one thing, throws
 * rather than guessing.
 */
import {
  addChild,
  addForce,
  addUnit,
  armyOptions,
  availableUnits,
  childOptions,
  chooseInGroup,
  createRoster,
  evaluate,
  setCount,
  type BattleSizeId,
  type OptionNode,
  type Roster,
  type RuleKind,
  type Scope,
  type SelView,
} from '../../src/roster';

/**
 * One unit; "Role > Name" picks between units of the same name by battlefield role (a Commissar can be Elites or
 * take no slot). Applied in this order:
 * - `models` sets model stack counts by model name (adding a stack that isn't there; 0 removes one).
 * - `warlord: true` selects the unit's option named `Warlord` (first, as it unlocks Warlord Traits; when the Warlord
 *   option only appears after another option, as on a Knight nominated as a CHARACTER, list it in `options` instead).
 * - `options` adds or chooses options anywhere in the unit's option tree, in order; "Model > Option" looks for the
 *   option only under the selection named "Model". In a group of one choice, an option replaces the current choice.
 */
export interface UnitSpec { name: string; models?: Record<string, number>; options?: string[]; warlord?: boolean }
/**
 * One detachment, from the roster's catalogue unless `catalogue` (a catalogue name) says otherwise. `army` picks
 * Configuration choices, e.g. `{ "Dynasty Choice": "Szarekhan" }`, adding the Configuration entry when the detachment
 * doesn't have it yet; a list picks several in one multi-choice group, an empty list only adds the entry.
 */
export interface DetachmentSpec { detachment: string; catalogue?: string; army?: Record<string, string | string[]>; units: UnitSpec[] }
export interface ListSpec { title: string; battleSize: BattleSizeId; detachments: DetachmentSpec[]; expect: { points: number; powerLevel: number } }
/** expectRules: the multiset of issue rules validate() reports, in any order. */
export interface IllegalSpec extends Omit<ListSpec, 'expect'> { expectRules: RuleKind[] }
/** One catalogue's corpus; `catalogue` is the catalogue name, the file name its slug. */
export interface CatalogueCorpus { catalogue: string; legal: ListSpec[]; illegal: IllegalSpec[] }

const SEPARATOR = '>';
const WARLORD = 'Warlord';

const same = (a: string, b: string) => a.trim() === b.trim();
const notFound = (name: string, parent: string) => new Error(`Corpus: "${name}" not found under "${parent}"`);
const ambiguous = (name: string, parent: string) => new Error(`Corpus: "${name}" is ambiguous under "${parent}"`);

function only<T>(hits: T[], name: string, parent: string): T {
  if (!hits.length) throw notFound(name, parent);
  if (hits.length > 1) throw ambiguous(name, parent);
  return hits[0];
}

export function buildFromSpec(scope: Scope, catalogueId: string, spec: ListSpec | IllegalSpec): Roster {
  let roster: Roster | undefined;
  for (const d of spec.detachments) {
    const catId = d.catalogue ? catalogueNamed(scope, d.catalogue, spec.title) : catalogueId;
    const forceId = forceNamed(scope, roster, catId, d.detachment, spec);
    if (!roster) {
      if (catId !== catalogueId) throw new Error(`Corpus: the first detachment of "${spec.title}" must come from the roster's catalogue`);
      roster = createRoster(scope, { name: spec.title, catalogueId, battleSize: spec.battleSize, forceId });
    } else roster = addForce(scope, roster, forceId, catId);
    const forceSelId = roster.forces[roster.forces.length - 1].id;
    for (const [config, choices] of Object.entries(d.army ?? {})) {
      const found = configSelection(scope, roster, forceSelId, config);
      roster = found.roster;
      for (const choice of Array.isArray(choices) ? choices : [choices]) {
        roster = pick(scope, roster, only(optionsIn(scope, roster, [found.selId], choice), choice, config));
      }
    }
    for (const u of d.units) roster = addSpecUnit(scope, roster, forceSelId, d.detachment, u);
  }
  if (!roster) throw new Error(`Corpus: "${spec.title}" has no detachments`);
  return roster;
}

function catalogueNamed(scope: Scope, name: string, parent: string): string {
  const ids = new Set(scope.files.filter((f) => same(f.name, name)).map((f) => f.id));
  return only([...ids], name, parent);
}

/** A force entry in scope whose name, as written or as evaluated in the roster so far, is `name`. */
function forceNamed(scope: Scope, r: Roster | undefined, catalogueId: string, name: string, spec: ListSpec | IllegalSpec): string {
  const base: Roster = r ?? { schema: 1, name: spec.title, catalogueId, battleSize: spec.battleSize, forces: [] };
  const ids = new Set<string>();
  for (const f of scope.files) {
    for (const fe of f.forces) {
      if (ids.has(fe.id)) continue;
      const trial: Roster = { ...base, forces: [...base.forces, { id: 'corpus-trial', forceId: fe.id, catalogueId, selections: [] }] };
      if (same(fe.name, name) || same(evaluate(scope, trial).forces.at(-1)!.name, name)) ids.add(fe.id);
    }
  }
  return only([...ids], name, spec.battleSize);
}

/** The force's Configuration selection named `config`, added first if it is missing. */
function configSelection(scope: Scope, r: Roster, forceSelId: string, config: string): { roster: Roster; selId: string } {
  const fv = evaluate(scope, r).forces.find((f) => f.force.id === forceSelId)!;
  const hits = fv.selections.filter((v) => same(v.name, config));
  if (hits.length) return { roster: r, selId: only(hits, config, fv.name).sel.id };
  const option = only(armyOptions(scope, r, forceSelId).filter((o) => same(o.name, config)), config, fv.name);
  return addUnit(scope, r, forceSelId, option.entryId);
}

function addSpecUnit(scope: Scope, r: Roster, forceSelId: string, detachment: string, u: UnitSpec): Roster {
  const [role, name] = u.name.includes(SEPARATOR) ? u.name.split(SEPARATOR).map((p) => p.trim()) : [null, u.name];
  const units = availableUnits(scope, r, forceSelId).filter((o) => same(o.name, name) && (role === null || o.role === role));
  const unit = only(units, u.name, detachment);
  let { roster, selId } = addUnit(scope, r, forceSelId, unit.entryId);
  for (const [model, count] of Object.entries(u.models ?? {})) roster = setModels(scope, roster, selId, u.name, model, count);
  // The Warlord option comes before the others: it unlocks Warlord Traits.
  if (u.warlord) roster = addOption(scope, roster, selId, u.name, WARLORD);
  for (const option of u.options ?? []) roster = addOption(scope, roster, selId, u.name, option);
  return roster;
}

/** The selection `selId` and everything under it. */
function subtree(scope: Scope, r: Roster, selId: string): SelView[] {
  const find = (vs: SelView[]): SelView | undefined => {
    for (const v of vs) {
      if (v.sel.id === selId) return v;
      const hit = find(v.children);
      if (hit) return hit;
    }
  };
  const root = find(evaluate(scope, r).forces.flatMap((f) => f.selections));
  const out: SelView[] = [];
  const walk = (v: SelView) => {
    out.push(v);
    v.children.forEach(walk);
  };
  if (root) walk(root);
  return out;
}

function setModels(scope: Scope, r: Roster, unitSelId: string, unit: string, model: string, count: number): Roster {
  const stacks = subtree(scope, r, unitSelId).slice(1).filter((v) => same(v.name, model));
  if (stacks.length) return setCount(scope, r, only(stacks, model, unit).sel.id, count);
  const hit = only(optionsIn(scope, r, [unitSelId], model), model, unit);
  return addChild(scope, r, hit.selId, hit.option.id, count);
}

function addOption(scope: Scope, r: Roster, unitSelId: string, unit: string, path: string): Roster {
  const parts = path.split(SEPARATOR).map((p) => p.trim());
  const name = parts.pop()!;
  let under = [unitSelId];
  let parent = unit;
  for (const part of parts) {
    const containers = subtree(scope, r, under[0]).filter((v) => same(v.name, part));
    under = [only(containers, part, parent).sel.id];
    parent = part;
  }
  return pick(scope, r, only(optionsIn(scope, r, under, name), name, parent));
}

interface OptionHit { selId: string; option: OptionNode; group: OptionNode | null }

/** Options named `name` under the selection `ids[0]` or any selection below it, with their nearest enclosing group. */
function optionsIn(scope: Scope, r: Roster, ids: string[], name: string): OptionHit[] {
  const out: OptionHit[] = [];
  const visit = (selId: string, nodes: OptionNode[], group: OptionNode | null) => {
    for (const n of nodes) {
      if (n.kind === 'group') visit(selId, n.children, n);
      else if (same(n.name, name)) out.push({ selId, option: n, group });
    }
  };
  for (const v of subtree(scope, r, ids[0])) visit(v.sel.id, childOptions(scope, r, v.sel.id), null);
  return out;
}

/** In a group of one choice, makes the option that choice; otherwise adds it, unless it is already there at its limit of one. */
function pick(scope: Scope, r: Roster, hit: OptionHit): Roster {
  if (hit.group?.max === 1) return chooseInGroup(scope, r, hit.selId, hit.group.id, hit.option.id);
  if (hit.option.max === 1 && hit.option.count > 0) return r;
  return addChild(scope, r, hit.selId, hit.option.id);
}
