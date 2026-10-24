import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { availableUnits, FORCE, type Roster, type Scope } from '@recruit/data/roster';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getRosterScope, resetDataCache } from '../factions/dataClient';
import { WordingProvider } from '../rules/wording';
import { stubGeneratedData } from './__fixtures__/generatedData';
import { NECRONS } from './__fixtures__/patrolList';
import { applyPicks, armyChoices, startingRoster } from './newListSetup';
import { loadUnitIndex } from './unitIndex';
import { UnitPicker } from './UnitPicker';

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

/** A Necrons Strike Force with the Szarekhan dynasty (which keeps Imotekh and other named characters out). */
async function szarekhan(): Promise<{ scope: Scope; roster: Roster }> {
  const scope = await getRosterScope(['necrons']);
  const start = startingRoster(scope, { name: 'x', catalogueId: NECRONS, sizeId: 'strike-force', forceId: FORCE.arksOfOmen });
  const c = armyChoices(scope, start).find((x) => x.title === 'Dynasty Choice')!;
  return { scope, roster: applyPicks(scope, start, [c], { [c.key]: c.options.find((o) => o.name === 'Dynasty: Szarekhan')!.id }) };
}

async function picker(props: { only?: string[]; role?: string } = {}) {
  const { scope, roster } = await szarekhan();
  const units = await loadUnitIndex(['necrons']);
  const onAdd = vi.fn();
  render(
    <WordingProvider initial="plain">
      <UnitPicker scope={scope} roster={roster} forceSelId={roster.forces[0].id} units={units} onAdd={onAdd} onClose={() => {}} {...props} />
    </WordingProvider>,
  );
  const options = availableUnits(scope, roster, roster.forces[0].id);
  return { onAdd, options, dialog: screen.getByRole('dialog', { name: 'Add a unit' }) };
}

const rows = (dialog: HTMLElement) => within(dialog).getAllByRole('button', { name: / points$/ });

test('the search box names the faction; role chips filter with their counts', async () => {
  const u = userEvent.setup();
  const { dialog, options } = await picker();
  expect(within(dialog).getByRole('searchbox', { name: 'Search units' })).toHaveAttribute('placeholder', 'Search Necrons units');
  const elites = options.filter((o) => o.role === 'Elites').length;
  expect(elites).toBe(15);
  const all = within(dialog).getByRole('button', { name: 'All' });
  expect(all).toHaveAttribute('aria-pressed', 'true');
  const chip = within(dialog).getByRole('button', { name: `Elites ${elites}` });
  await u.click(chip);
  expect(chip).toHaveAttribute('aria-pressed', 'true');
  expect(all).toHaveAttribute('aria-pressed', 'false');
  expect(rows(dialog)).toHaveLength(elites);
  expect(within(dialog).queryByRole('button', { name: /^Necron Warriors/ })).not.toBeInTheDocument();
});

test('each row shows the unit’s size and key stats and what it costs', async () => {
  const { dialog } = await picker();
  const row = within(dialog).getByRole('button', { name: /^Skorpekh Destroyers/ });
  expect(row).toHaveTextContent('3–5 models · M8" T5 W3 Sv3+');
  expect(row).toHaveAccessibleName(/from 90 points$/);
});

test('tapping a unit opens its datasheet; Add to list adds it', async () => {
  const u = userEvent.setup();
  const { dialog, onAdd, options } = await picker();
  await u.click(within(dialog).getByRole('button', { name: /^Skorpekh Destroyers/ }));
  const preview = screen.getByRole('dialog', { name: 'Skorpekh Destroyers' });
  expect(within(preview).getByRole('group', { name: /characteristics$/ })).toBeInTheDocument();
  await u.click(within(preview).getByRole('button', { name: 'Add to list · 90 pts' }));
  expect(onAdd).toHaveBeenCalledWith(options.find((o) => o.name === 'Skorpekh Destroyers')!.entryId);
});

test('the + on a row adds the unit straight away', async () => {
  const u = userEvent.setup();
  const { dialog, onAdd, options } = await picker();
  await u.click(within(dialog).getByRole('button', { name: 'Add Lychguard' }));
  expect(onAdd).toHaveBeenCalledWith(options.find((o) => o.name === 'Lychguard')!.entryId);
  expect(screen.queryByRole('dialog', { name: 'Lychguard' })).not.toBeInTheDocument();
});

test('units the army’s choices keep out are listed last, with no add button, and still preview', async () => {
  const u = userEvent.setup();
  const { dialog } = await picker();
  const section = within(dialog).getByRole('region', { name: 'Not available with this army’s current choices' });
  expect(section).toHaveTextContent('Changing your dynasty, detachment or Army of Renown may make these available.');
  const imotekh = within(section).getByRole('button', { name: /^Imotekh the Stormlord/ });
  expect(within(section).queryByRole('button', { name: 'Add Imotekh the Stormlord' })).not.toBeInTheDocument();
  await u.click(imotekh);
  const preview = screen.getByRole('dialog', { name: 'Imotekh the Stormlord' });
  expect(within(preview).queryByRole('button', { name: /^Add to list/ })).not.toBeInTheDocument();
});

test('a role chip set by the role section’s + shows that role first', async () => {
  const { dialog } = await picker({ role: 'HQ' });
  expect(within(dialog).getByRole('button', { name: /^HQ \d+$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(within(dialog).getByRole('button', { name: /^Overlord/ })).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: /^Lychguard/ })).not.toBeInTheDocument();
});

test('a fix’s suggestions come first; Show all units shows the rest', async () => {
  const u = userEvent.setup();
  const { scope, roster } = await szarekhan();
  const lord = availableUnits(scope, roster, roster.forces[0].id).find((o) => o.name === 'Lord')!;
  const { dialog } = await picker({ only: [lord.entryId] });
  expect(within(dialog).getByText('Units that fix this problem.')).toBeInTheDocument();
  expect(rows(dialog).map((r) => r.textContent)).toEqual([expect.stringMatching(/^Lord/)]);
  await u.click(within(dialog).getByRole('button', { name: 'Show all units' }));
  expect(rows(dialog).length).toBeGreaterThan(50);
});
