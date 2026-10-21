/**
 * Hand-built roster fixture: a system file, a library and one catalogue, shaped like BSData v9.8.0.
 * Exported as RosterFile[] in scope order (system last) so other packages' tests can reuse it.
 */
import { COST_CP, COST_PL, COST_PTS, type Cond, type RNode, type RosterFile } from '../../../src/roster/types';

// ---- system (.gst) ----
export const SYSTEM_ID = 'sys-mini';
export const CAT_HQ = 'cat-hq';
export const CAT_TROOPS = 'cat-troops';
export const CAT_ELITES = 'cat-elites';
export const CAT_CHARACTER = 'cat-character';
export const CAT_WARLORD = 'cat-warlord';
export const CAT_DAEMON = 'cat-daemon';
export const CAT_BODYGUARD = 'cat-bodyguard';
export const FORCE_PATROL = 'force-patrol';
export const FORCE_BATTALION = 'force-battalion';
/** System root upgrade shaped like the gst's Daemonic Pact: max 0, becomes max 1 while daemons are ≤ 25% of the roster's PL. */
export const E_PACT = 'se-pact';
export const C_PACT_MAX = 'con-pact-max';

// ---- library ----
export const LIB_ID = 'cat-mini-lib';
export const E_BEAST = 'se-beast';

// ---- catalogue ----
export const CAT_ID = 'cat-mini';
export const L_WARRIORS = 'el-warriors';
export const E_WARRIORS = 'se-warriors';
export const G_WARRIORS = 'seg-warriors';
export const L_WARRIOR_MODEL = 'el-warrior-model';
export const E_WARRIOR_MODEL = 'se-warrior-model';
export const L_GAUSS = 'el-gauss';
export const E_GAUSS = 'se-gauss';
export const C_WARRIORS_MIN = 'con-warriors-min';
export const C_WARRIORS_MAX = 'con-warriors-max';

export const L_LORD = 'el-lord';
export const E_LORD = 'se-lord';
export const E_WARLORD_UPG = 'se-warlord';
export const G_LORD_MELEE = 'seg-lord-melee';
/** Link to E_BLADE whose pts (5) override the target's (10); PL comes from the target. */
export const L_LORD_BLADE = 'el-lord-blade';
/** Link to E_BLADE with an explicit 0 pts, which also overrides the target. */
export const L_LORD_CLAWS = 'el-lord-claws';
export const E_BLADE = 'se-blade';

export const L_SQUAD = 'el-squad';
export const E_SQUAD = 'se-squad';
export const L_SQUAD_MODEL = 'el-squad-model';
export const E_SQUAD_MODEL = 'se-squad-model';
export const G_SQUAD_WEAPON = 'seg-squad-weapon';
export const E_BOLTER = 'se-bolter';
export const E_PLASMA = 'se-plasma';
export const C_SQUAD_MODELS_MIN = 'con-squad-models-min';
export const C_SQUAD_MODELS_MAX = 'con-squad-models-max';
export const C_SQUAD_WEAPON_MIN = 'con-squad-weapon-min';
export const C_SQUAD_WEAPON_MAX = 'con-squad-weapon-max';

export const L_IMP = 'el-imp';
export const E_IMP = 'se-imp';

/** "Horde": repeat modifiers. +10 pts per 3 models (×2 repeats), +1 PL per 4 models rounded up, and a value-0 repeat on CP. */
export const L_HORDE = 'el-horde';
export const E_HORDE = 'se-horde';
export const L_HORDE_MODEL = 'el-horde-model';
export const E_HORDE_MODEL = 'se-horde-model';

const min = (id: string, value: number, scope = 'parent') => ({ id, type: 'min' as const, field: 'selections', scope, value });
const max = (id: string, value: number, scope = 'parent') => ({ id, type: 'max' as const, field: 'selections', scope, value });
const atLeast1 = (scope: string, childId: string): Cond => ({ type: 'atLeast', field: 'selections', scope, childId, value: 1, childSel: true });

export const system: RosterFile = {
  schema: 1,
  id: SYSTEM_ID,
  name: 'Mini System',
  slug: 'system',
  library: false,
  links: [],
  rootEntries: [
    {
      id: E_PACT,
      kind: 'entry',
      name: 'Pact',
      type: 'upgrade',
      constraints: [{ ...max(C_PACT_MAX, 0, 'roster'), childSel: true, childForces: true }],
      mods: [
        {
          type: 'set',
          field: C_PACT_MAX,
          value: '1.0',
          when: {
            type: 'and',
            conds: [
              { type: 'atMost', field: COST_PL, scope: 'roster', childId: CAT_DAEMON, value: 25, percent: true, childSel: true, childForces: true },
            ],
            groups: [],
          },
        },
      ],
    },
  ],
  shared: [],
  categories: [
    { id: CAT_HQ, name: 'HQ' },
    { id: CAT_TROOPS, name: 'Troops' },
    { id: CAT_ELITES, name: 'Elites' },
    { id: CAT_CHARACTER, name: 'Character' },
    { id: CAT_WARLORD, name: 'Warlord' },
    { id: CAT_DAEMON, name: 'Daemon' },
    { id: CAT_BODYGUARD, name: 'Bodyguard' },
  ],
  forces: [
    {
      id: FORCE_PATROL,
      name: 'Patrol Detachment',
      cats: [
        { id: 'cl-patrol-hq', targetId: CAT_HQ, constraints: [{ ...min('con-patrol-hq-min', 1, 'force'), childSel: true }, { ...max('con-patrol-hq-max', 2, 'force'), childSel: true }] },
        { id: 'cl-patrol-troops', targetId: CAT_TROOPS, constraints: [{ ...min('con-patrol-troops-min', 1, 'force'), childSel: true }, { ...max('con-patrol-troops-max', 3, 'force'), childSel: true }] },
        { id: 'cl-patrol-elites', targetId: CAT_ELITES, constraints: [{ ...max('con-patrol-elites-max', 2, 'force'), childSel: true }] },
      ],
    },
    {
      id: FORCE_BATTALION,
      name: 'Battalion Detachment',
      cats: [
        { id: 'cl-bat-hq', targetId: CAT_HQ, constraints: [{ ...min('con-bat-hq-min', 2, 'force'), childSel: true }, { ...max('con-bat-hq-max', 3, 'force'), childSel: true }] },
        { id: 'cl-bat-troops', targetId: CAT_TROOPS, constraints: [{ ...min('con-bat-troops-min', 3, 'force'), childSel: true }, { ...max('con-bat-troops-max', 6, 'force'), childSel: true }] },
        { id: 'cl-bat-elites', targetId: CAT_ELITES, constraints: [{ ...max('con-bat-elites-max', 6, 'force'), childSel: true }] },
      ],
    },
  ],
};

export const library: RosterFile = {
  schema: 1,
  id: LIB_ID,
  name: 'Mini Library',
  slug: 'mini-library',
  library: true,
  links: [],
  rootEntries: [{ id: E_BEAST, kind: 'entry', name: 'Beast', type: 'model', costs: { [COST_PTS]: 20, [COST_PL]: 1 }, cats: [{ id: 'cl-beast-elites', targetId: CAT_ELITES, primary: true }] }],
  shared: [],
  categories: [],
  forces: [],
};

const warriors: RNode = {
  id: E_WARRIORS,
  kind: 'entry',
  name: 'Warriors',
  type: 'unit',
  costs: { [COST_PL]: 6 },
  mods: [
    // Same shape as Necron Warriors: PL 12 when the unit (scoped by its own id) has more than 10 models.
    {
      type: 'set',
      field: COST_PL,
      value: '12.0',
      when: { type: 'and', conds: [{ type: 'greaterThan', field: 'selections', scope: E_WARRIORS, childId: 'model', value: 10, childSel: true }], groups: [] },
    },
    // Fixed point: becomes Bodyguard once the roster has a Warlord (a category another modifier adds to the Lord).
    { type: 'add', field: 'category', value: CAT_BODYGUARD, when: { type: 'and', conds: [atLeast1('roster', CAT_WARLORD)], groups: [] } },
  ],
  children: [
    {
      id: G_WARRIORS,
      kind: 'group',
      name: 'Warriors',
      defaultId: L_WARRIOR_MODEL,
      constraints: [max(C_WARRIORS_MAX, 20), min(C_WARRIORS_MIN, 10)],
      children: [
        { id: L_WARRIOR_MODEL, kind: 'link', name: 'Warrior', targetId: E_WARRIOR_MODEL, targetKind: 'entry', constraints: [max('con-warrior-link-max', 20)] },
      ],
    },
  ],
};

const lord: RNode = {
  id: E_LORD,
  kind: 'entry',
  name: 'Lord',
  type: 'model',
  costs: { [COST_PTS]: 80, [COST_PL]: 5 },
  cats: [{ id: 'cl-lord-character', targetId: CAT_CHARACTER }],
  mods: [{ type: 'add', field: 'category', value: CAT_WARLORD, when: { type: 'and', conds: [atLeast1('self', E_WARLORD_UPG)], groups: [] } }],
  children: [
    { id: E_WARLORD_UPG, kind: 'entry', name: 'Warlord', type: 'upgrade', constraints: [max('con-warlord-max', 1)] },
    {
      id: G_LORD_MELEE,
      kind: 'group',
      name: 'Melee weapon',
      constraints: [max('con-lord-melee-max', 1)],
      children: [
        { id: L_LORD_BLADE, kind: 'link', name: 'Blade', targetId: E_BLADE, targetKind: 'entry', costs: { [COST_PTS]: 5 } },
        { id: L_LORD_CLAWS, kind: 'link', name: 'Claws', targetId: E_BLADE, targetKind: 'entry', costs: { [COST_PTS]: 0 } },
      ],
    },
  ],
};

const squad: RNode = {
  id: E_SQUAD,
  kind: 'entry',
  name: 'Squad',
  type: 'unit',
  costs: { [COST_PL]: 5 },
  children: [
    {
      id: L_SQUAD_MODEL,
      kind: 'link',
      name: 'Squad Marine',
      targetId: E_SQUAD_MODEL,
      targetKind: 'entry',
      constraints: [min(C_SQUAD_MODELS_MIN, 5), max(C_SQUAD_MODELS_MAX, 10)],
    },
  ],
};

const horde: RNode = {
  id: E_HORDE,
  kind: 'entry',
  name: 'Horde',
  type: 'unit',
  costs: { [COST_PL]: 2 },
  mods: [
    { type: 'increment', field: COST_PTS, value: '10', repeats: [{ field: 'selections', scope: 'self', childId: 'model', value: 3, repeats: 2, childSel: true }] },
    { type: 'increment', field: COST_PL, value: '1', repeats: [{ field: 'selections', scope: 'self', childId: 'model', value: 4, repeats: 1, roundUp: true, childSel: true }] },
    { type: 'increment', field: COST_CP, value: '1', repeats: [{ field: 'selections', scope: 'self', childId: 'model', value: 0, repeats: 1, childSel: true }] },
  ],
  children: [{ id: L_HORDE_MODEL, kind: 'link', name: 'Horde model', targetId: E_HORDE_MODEL, targetKind: 'entry', constraints: [max('con-horde-max', 20)] }],
};

export const catalogue: RosterFile = {
  schema: 1,
  id: CAT_ID,
  name: 'Mini Faction',
  slug: 'mini',
  library: false,
  links: [{ targetId: LIB_ID, importRootEntries: true }],
  rootEntries: [
    { id: L_WARRIORS, kind: 'link', name: 'Warriors', targetId: E_WARRIORS, targetKind: 'entry', cats: [{ id: 'cl-warriors-troops', targetId: CAT_TROOPS, primary: true }] },
    { id: L_LORD, kind: 'link', name: 'Lord', targetId: E_LORD, targetKind: 'entry', cats: [{ id: 'cl-lord-hq', targetId: CAT_HQ, primary: true }] },
    { id: L_SQUAD, kind: 'link', name: 'Squad', targetId: E_SQUAD, targetKind: 'entry', cats: [{ id: 'cl-squad-elites', targetId: CAT_ELITES, primary: true }] },
    { id: L_IMP, kind: 'link', name: 'Imps', targetId: E_IMP, targetKind: 'entry', cats: [{ id: 'cl-imp-elites', targetId: CAT_ELITES, primary: true }] },
    { id: L_HORDE, kind: 'link', name: 'Horde', targetId: E_HORDE, targetKind: 'entry', cats: [{ id: 'cl-horde-troops', targetId: CAT_TROOPS, primary: true }] },
  ],
  shared: [
    warriors,
    { id: E_WARRIOR_MODEL, kind: 'entry', name: 'Warrior', type: 'model', costs: { [COST_PTS]: 11 }, children: [
      { id: L_GAUSS, kind: 'link', name: 'Gauss Flayer', targetId: E_GAUSS, targetKind: 'entry', constraints: [min('con-gauss-min', 1), max('con-gauss-max', 1)] },
    ] },
    { id: E_GAUSS, kind: 'entry', name: 'Gauss Flayer', type: 'upgrade' },
    lord,
    { id: E_BLADE, kind: 'entry', name: 'Blade', type: 'upgrade', costs: { [COST_PTS]: 10, [COST_PL]: 1 } },
    squad,
    {
      id: E_SQUAD_MODEL,
      kind: 'entry',
      name: 'Squad Marine',
      type: 'model',
      costs: { [COST_PTS]: 18 },
      children: [
        {
          id: G_SQUAD_WEAPON,
          kind: 'group',
          name: 'Weapon',
          defaultId: E_BOLTER,
          constraints: [max(C_SQUAD_WEAPON_MAX, 1), min(C_SQUAD_WEAPON_MIN, 1)],
          children: [
            { id: E_BOLTER, kind: 'entry', name: 'Bolter', type: 'upgrade' },
            { id: E_PLASMA, kind: 'entry', name: 'Plasma', type: 'upgrade', costs: { [COST_PTS]: 5 } },
          ],
        },
      ],
    },
    { id: E_IMP, kind: 'entry', name: 'Imps', type: 'unit', costs: { [COST_PL]: 2, [COST_PTS]: 30 }, cats: [{ id: 'cl-imp-daemon', targetId: CAT_DAEMON }] },
    horde,
    { id: E_HORDE_MODEL, kind: 'entry', name: 'Horde model', type: 'model', costs: { [COST_PTS]: 1 } },
  ],
  categories: [],
  forces: [],
};

/** Scope order for the catalogue: the catalogue, its library, then the system. */
export const miniFiles: RosterFile[] = [catalogue, library, system];
