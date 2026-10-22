import { newGame, stateOf, type Command, type GameRecord, type GameSetup, type Pos } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { deployedGame, must, realSheet, sampleSetup, ULTRAMARINES } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import { assignmentsFor, defaultChoices, ShootingPanel, weaponGroups } from './ShootingPanel';

const at = (x: number, y: number): Pos => ({ x, y, z: 0, rot: 0 });
const shooting = (g: GameRecord): GameRecord => {
  for (let i = 0; i < 3; i++) g = must(g, { type: 'endPhase', by: 'A' } as Command);
  expect(stateOf(g).phase).toBe('shooting');
  return g;
};

test('picks a target by tapping it and shoots: the attack opens the hit roll', async () => {
  const h = renderPanel(ShootingPanel, shooting(deployedGame({ bY: 20 })));
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  expect(screen.getByText('Gauss Flayer ×10, 24" Rapid Fire 1')).toBeInTheDocument();
  h.tap({ x: 18, y: 20 }, 'B:int.m1');
  expect(h.targets()).toEqual(['B:int']);
  await userEvent.click(screen.getByRole('button', { name: 'Shoot' }));
  const s = stateOf(h.record());
  expect(s.pending?.kind).toBe('roll');
  expect(s.units['A:war'].turn.shot).toBe(true);
});

test("an out-of-range target shows the engine's message", async () => {
  let g = deployedGame({ rollWindows: false });
  stateOf(g).units['B:int'].modelIds.forEach((id, i) => (g = must(g, { type: 'placeModel', by: 'B', modelId: id, pos: at(36 + i * 1.5, 29) } as Command)));
  const h = renderPanel(ShootingPanel, shooting(g));
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  h.tap({ x: 36, y: 29 }, 'B:int.m1');
  await userEvent.click(screen.getByRole('button', { name: 'Shoot' }));
  expect(h.problems().map((p) => p.message)).toContain('Intercessor Squad is out of range of Gauss Flayer (24").');
  expect(stateOf(h.record()).units['A:war'].turn.shot).toBe(false);
});

test('Rapid Fire weapons show their range ring when focused', async () => {
  const h = renderPanel(ShootingPanel, shooting(deployedGame()));
  h.tap({ x: 14, y: 4 }, 'A:war.m1');
  await userEvent.click(screen.getByRole('button', { name: 'Show range: Gauss Flayer' }));
  const rings = h.rings().filter((r) => r.kind === 'weapon');
  expect(rings).toHaveLength(10);
  expect(rings[0].r).toBeCloseTo(24 + 16 / 25.4);
  expect(rings[0].label).toBe('24"');
});

describe('weapon groups', () => {
  function hellblasters() {
    const base = sampleSetup();
    const unit = {
      id: 'B:hb',
      datasheet: realSheet(ULTRAMARINES, 'Hellblaster Squad'),
      models: [{ profile: 'Hellblaster', weapons: ['Plasma incinerator, Standard', 'Plasma incinerator, Supercharge', 'Bolt pistol', 'Frag grenades'], count: 5 }],
    };
    const setup: GameSetup = { ...base, armies: [base.armies[0], { ...base.armies[1], units: [unit] }] };
    return stateOf(newGame(setup));
  }

  test('multi-profile weapons fire one chosen profile', () => {
    const s = hellblasters();
    const groups = weaponGroups(s, 'B:hb');
    const plasma = groups.find((g) => g.profiles.length === 2)!;
    expect(plasma.profiles).toEqual(['Plasma incinerator, Standard', 'Plasma incinerator, Supercharge']);
    const choices = defaultChoices(s, groups);
    expect(choices[plasma.key]).toMatchObject({ profile: 'Plasma incinerator, Standard', on: true });
    choices[plasma.key] = { ...choices[plasma.key], profile: 'Plasma incinerator, Supercharge', target: 'A:war' };
    const out = assignmentsFor(groups, choices);
    expect(out).toHaveLength(5);
    expect(new Set(out.map((a) => a.weapon))).toEqual(new Set(['Plasma incinerator, Supercharge']));
  });

  test('pistols and grenades start switched off when the models have other guns', () => {
    const s = hellblasters();
    const groups = weaponGroups(s, 'B:hb');
    const choices = defaultChoices(s, groups);
    expect(choices[groups.find((g) => g.profiles[0] === 'Bolt pistol')!.key].on).toBe(false);
    expect(choices[groups.find((g) => g.profiles[0] === 'Frag grenades')!.key].on).toBe(false);
  });
});
