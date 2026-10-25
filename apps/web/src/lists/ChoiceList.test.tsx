import type { EntryInfo } from '@recruit/data/model';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { WordingProvider, type Wording } from '../rules/wording';
import { ChoiceList, type ChoiceOption } from './ChoiceList';

const novokh: EntryInfo = {
  profiles: [
    {
      name: 'Awakened By Murder',
      type: 'Dynastic Code',
      chars: { Description: 'Add 1 to the charge rolls made for units with this code. Each time a model with this code makes a melee attack…' },
      plain: { Description: '+1 to charge rolls. Melee attacks get +1 AP after charging.' },
    },
  ],
};
const relic: EntryInfo = {
  profiles: [{ name: 'Blood Scythe', type: 'Weapon', chars: { Range: 'Melee', Type: 'Melee', S: '+2', AP: '-4', D: '2', Abilities: '-' } }],
  rules: [{ name: 'Relic', text: 'Replaces a warscythe.' }],
};

const options: ChoiceOption[] = [
  { id: 'nov', label: 'Novokh', summary: '+1 to charge rolls.', info: novokh },
  { id: 'sza', label: 'Szarekhan', summary: 'Ignore mortal wounds on a 5+.', info: { rules: [{ name: 'Uncanny Artificers', text: 'Ignore mortal wounds on a 5+.' }] }, official: true },
  { id: 'cus', label: 'Custom dynasty', summary: null, info: undefined },
];

function renderList(props: Partial<Parameters<typeof ChoiceList>[0]> = {}, wording: Wording = 'plain') {
  const onPick = vi.fn();
  render(
    <WordingProvider initial={wording}>
      <ChoiceList name="dynasty" legend="Dynasty" multi={false} options={options} selected={['nov']} onPick={onPick} {...props} />
    </WordingProvider>,
  );
  return onPick;
}

test('each option is a radio named by its label, with its one-line effect under it', () => {
  renderList();
  const group = screen.getByRole('group', { name: 'Dynasty' });
  const radios = within(group).getAllByRole('radio');
  expect(radios.map((r) => r.getAttribute('aria-describedby') && document.getElementById(r.getAttribute('aria-describedby')!)?.textContent)).toEqual([
    '+1 to charge rolls.',
    'Official wording Ignore mortal wounds on a 5+.',
    null,
  ]);
  expect(screen.getByRole('radio', { name: 'Novokh' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Szarekhan' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Novokh' }).closest('.choice-row')).toHaveClass('choice-row--on');
});

test('picking an option calls onPick with its id', async () => {
  const onPick = renderList();
  await userEvent.click(screen.getByRole('radio', { name: 'Szarekhan' }));
  expect(onPick).toHaveBeenCalledWith('sza');
});

test('an official summary is labelled Official wording only while plain English is chosen', () => {
  renderList({}, 'official');
  expect(screen.queryByText('Official wording')).not.toBeInTheDocument();
});

test('ⓘ opens the full text: abilities in the chosen wording, rules, and weapon profiles', async () => {
  renderList({ options: [options[0], { id: 'rel', label: 'Blood Scythe', summary: 'Replaces a warscythe.', info: relic }] });
  await userEvent.click(screen.getByRole('button', { name: 'About Novokh' }));
  const sheet = screen.getByRole('dialog', { name: 'Novokh' });
  expect(within(sheet).getByText('Awakened By Murder')).toBeInTheDocument();
  expect(within(sheet).getByText('+1 to charge rolls. Melee attacks get +1 AP after charging.')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'About Blood Scythe' }));
  const scythe = screen.getByRole('dialog', { name: 'Blood Scythe' });
  expect(within(scythe).getByRole('article', { name: 'Blood Scythe' })).toHaveTextContent('Melee');
  expect(within(scythe).getByText('Replaces a warscythe.')).toBeInTheDocument();
});

test('an option with no info shows no ⓘ and no summary', () => {
  renderList();
  expect(screen.queryByRole('button', { name: 'About Custom dynasty' })).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Custom dynasty' })).not.toHaveAttribute('aria-describedby');
  expect(screen.getByRole('radio', { name: 'Custom dynasty' }).closest('.choice-row')).not.toHaveTextContent(/undefined|null/);
});

test('an optional group offers None first, which picks null', async () => {
  const onPick = renderList({ noneOption: true, selected: [] });
  const radios = screen.getAllByRole('radio');
  expect(radios[0]).toHaveAccessibleName('None');
  expect(radios[0]).toBeChecked();
  await userEvent.click(screen.getByRole('radio', { name: 'Novokh' }));
  expect(onPick).toHaveBeenLastCalledWith('nov');
  onPick.mockClear();
});

test('None picks null when something is chosen', async () => {
  const onPick = renderList({ noneOption: true, selected: ['nov'] });
  await userEvent.click(screen.getByRole('radio', { name: 'None' }));
  expect(onPick).toHaveBeenCalledWith(null);
});

test('multi is a set of checkboxes; disabled ids can’t be picked', async () => {
  const onPick = renderList({ multi: true, selected: ['nov'], disabledIds: ['cus'] });
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  expect(screen.getByRole('checkbox', { name: 'Novokh' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Custom dynasty' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Szarekhan' }));
  expect(onPick).toHaveBeenCalledWith('sza');
});
