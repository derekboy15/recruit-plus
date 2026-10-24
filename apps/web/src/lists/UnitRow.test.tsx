import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluate, type SelView } from '@recruit/data/roster';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getRosterScope, resetDataCache } from '../factions/dataClient';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { novokhPatrol } from './__fixtures__/patrolList';
import { UnitRow } from './UnitRow';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

async function unit(name: string): Promise<SelView> {
  const scope = await getRosterScope(['necrons']);
  return evaluate(scope, novokhPatrol(scope)).forces[0].selections.find((v) => v.name === name)!;
}

function row(v: SelView, issues: string[] = []) {
  const handlers = { onOpen: vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onDatasheet: vi.fn() };
  render(
    <MemoryRouter>
      <ul>
        <UnitRow v={v} issues={issues} {...handlers} />
      </ul>
    </MemoryRouter>,
  );
  return handlers;
}

test('a Warlord’s row says Warlord and names its trait, under its wargear, with its points', async () => {
  row(await unit('Overlord'));
  const open = screen.getByRole('button', { name: /^Overlord/ });
  expect(open).toHaveTextContent('Warlord · Blood-Fuelled Fury');
  expect(open).toHaveTextContent('90');
  expect(open.querySelector('.unit-row__gear')).toHaveTextContent('Tachyon Arrow · Hyperphase Glaive');
  expect(open).not.toHaveTextContent(/Warlord Trait \(|Novokh\)/);
});

test('a squad’s row counts its models and its weapons', async () => {
  row(await unit('Immortals'));
  const open = screen.getByRole('button', { name: /^Immortals/ });
  expect(open.querySelector('.unit-row__name')).toHaveTextContent('Immortals · 5');
  expect(open).toHaveTextContent('5x Gauss Blaster');
  expect(open).not.toHaveTextContent('Warlord');
});

test('a unit with a problem shows the first sentence of it', async () => {
  row(await unit('Royal Warden'), ['This unit needs a weapon. Pick one below.', 'Another problem.']);
  const open = screen.getByRole('button', { name: /^Royal Warden/ });
  expect(open).toHaveTextContent('This unit needs a weapon.');
  expect(open).not.toHaveTextContent('Pick one below');
  expect(open).not.toHaveTextContent('Another problem');
});

test('tapping the row opens the unit; its ⋯ menu offers Duplicate, Remove and View datasheet', async () => {
  const u = userEvent.setup();
  const h = row(await unit('Overlord'));
  await u.click(screen.getByRole('button', { name: /^Overlord/ }));
  expect(h.onOpen).toHaveBeenCalled();
  await u.click(screen.getByRole('button', { name: 'Options for Overlord' }));
  const menu = screen.getByRole('menu', { name: 'Options for Overlord' });
  expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Duplicate', 'Remove', 'View datasheet']);
  await u.click(within(menu).getByRole('menuitem', { name: 'Remove' }));
  expect(h.onRemove).toHaveBeenCalled();
});
