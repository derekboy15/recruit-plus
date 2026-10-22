import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { RulesText } from './RulesText';
import { WORDING_KEY, WordingProvider, WordingToggle, useWording } from './wording';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function Probe() {
  const { wording } = useWording();
  return <p>wording: {wording}</p>;
}

test('defaults to plain and remembers the choice', async () => {
  render(
    <WordingProvider>
      <WordingToggle />
      <Probe />
    </WordingProvider>,
  );
  expect(screen.getByText('wording: plain')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Plain English' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Official wording' }));
  expect(screen.getByText('wording: official')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Official wording' })).toHaveAttribute('aria-pressed', 'true');
  expect(localStorage.getItem(WORDING_KEY)).toBe('official');
});

test('a remembered official choice is restored', () => {
  localStorage.setItem(WORDING_KEY, 'official');
  render(
    <WordingProvider>
      <Probe />
    </WordingProvider>,
  );
  expect(screen.getByText('wording: official')).toBeInTheDocument();
});

test('blocked storage still renders plain', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  render(
    <WordingProvider>
      <WordingToggle />
      <Probe />
    </WordingProvider>,
  );
  expect(screen.getByText('wording: plain')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Official wording' }));
  expect(screen.getByText('wording: official')).toBeInTheDocument();
});

test('the toggle is a labelled group of two buttons', () => {
  render(
    <WordingProvider>
      <WordingToggle />
    </WordingProvider>,
  );
  expect(screen.getByRole('group', { name: 'Rules wording' })).toBeInTheDocument();
});

test('RulesText shows plain English by default', () => {
  render(
    <WordingProvider>
      <RulesText official="Official words." plain="Plain words." />
    </WordingProvider>,
  );
  expect(screen.getByText('Plain words.')).toBeInTheDocument();
  expect(screen.queryByText('Official words.')).not.toBeInTheDocument();
});

test('RulesText falls back to the official wording with a label', () => {
  render(
    <WordingProvider>
      <RulesText official="Official words." />
    </WordingProvider>,
  );
  expect(screen.getByText('Official wording (plain-English version not ready yet)')).toBeInTheDocument();
  expect(screen.getByText('Official words.')).toBeInTheDocument();
});

test('RulesText shows the official wording when chosen', () => {
  render(
    <WordingProvider initial="official">
      <RulesText official="Official words." plain="Plain words." />
    </WordingProvider>,
  );
  expect(screen.getByText('Official words.')).toBeInTheDocument();
  expect(screen.queryByText('Plain words.')).not.toBeInTheDocument();
  expect(screen.queryByText(/not ready yet/)).not.toBeInTheDocument();
});

test('RulesText shows a rules update under either wording', () => {
  const { rerender } = render(
    <WordingProvider>
      <RulesText official="Official words." plain="Plain words." amended="Now 3 inches." />
    </WordingProvider>,
  );
  expect(screen.getByText('Rules update: Now 3 inches.')).toBeInTheDocument();
  rerender(
    <WordingProvider initial="official">
      <RulesText official="Official words." plain="Plain words." amended="Now 3 inches." />
    </WordingProvider>,
  );
  expect(screen.getByText('Rules update: Now 3 inches.')).toBeInTheDocument();
});
