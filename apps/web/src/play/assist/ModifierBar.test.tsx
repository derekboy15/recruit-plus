import { gameLog, stateOf } from '@recruit/engine';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { deployedGame } from '../__fixtures__/game';
import { renderPanel } from '../__fixtures__/panel';
import type { PanelProps } from '../panels/types';
import { ModifierBar } from './ModifierBar';

const Bar = (p: PanelProps) => <ModifierBar {...p} unitId="A:war" />;
const effects = (h: ReturnType<typeof renderPanel>) => stateOf(h.record()).effects;

test('+1 to hit adds an attacking hit modifier for this phase', async () => {
  const h = renderPanel(Bar, deployedGame());
  await userEvent.click(screen.getByRole('button', { name: '+1 to hit' }));
  expect(effects(h)).toEqual([{ id: 'e1', unitId: 'A:war', side: 'attacking', effect: { kind: 'mod', roll: 'hit', value: 1 }, until: 'phase', note: '+1 to hit' }]);
});

test('an enemy −1 to hit protects this unit (a defending modifier)', async () => {
  const h = renderPanel(Bar, deployedGame());
  await userEvent.click(screen.getByRole('button', { name: 'Enemy −1 to hit' }));
  expect(effects(h)[0]).toMatchObject({ side: 'defending', effect: { kind: 'mod', roll: 'hit', value: -1 } });
});

test('Feel No Pain 5+ adds a defending effect, lasting as chosen', async () => {
  const h = renderPanel(Bar, deployedGame());
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lasts' }), 'battle');
  await userEvent.click(screen.getByRole('button', { name: 'Feel No Pain 5+' }));
  expect(effects(h)[0]).toMatchObject({ side: 'defending', effect: { kind: 'fnp', value: 5 }, until: 'battle' });
});

test('removing an effect takes it off', async () => {
  const h = renderPanel(Bar, deployedGame());
  await userEvent.click(screen.getByRole('button', { name: 'Re-roll hits of 1' }));
  expect(effects(h)[0].effect).toEqual({ kind: 'reroll', roll: 'hit', which: 'ones' });
  await userEvent.click(screen.getByRole('button', { name: 'Remove: Re-roll hits of 1 (this phase)' }));
  expect(effects(h)).toEqual([]);
});

test('Mortal wounds… inflicts them and the log says so', async () => {
  const h = renderPanel(Bar, deployedGame());
  await userEvent.click(screen.getByRole('button', { name: 'More mortal wounds' }));
  await userEvent.click(screen.getByRole('button', { name: 'Inflict 2 mortal wounds' }));
  expect(gameLog(h.record()).map((l) => l.text)).toContain('Necron Warriors lost 2 models (mortal wounds).');
});

test('a note is kept with the effect in the log', async () => {
  const h = renderPanel(Bar, deployedGame());
  await userEvent.type(screen.getByRole('textbox', { name: 'Why (for the log)' }), 'My Will Be Done');
  await userEvent.click(screen.getByRole('button', { name: '+1 to wound' }));
  expect(gameLog(h.record()).at(-1)!.text).toBe('Necron Warriors: My Will Be Done.');
});
