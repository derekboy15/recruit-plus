import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { DiceTray } from './DiceTray';

const motion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const dice = [
  { value: 3, sides: 6 as const },
  { value: 5, sides: 6 as const, rerolled: true as const },
];

test('dice tumble then show their values; with reduced motion they show at once', () => {
  motion(false);
  vi.useFakeTimers();
  const { rerender } = render(<DiceTray dice={dice} rollKey="r1" />);
  expect(screen.queryByLabelText('Die 1: 3')).toBeNull();
  act(() => void vi.advanceTimersByTime(650));
  expect(screen.getByLabelText('Die 1: 3')).toBeInTheDocument();
  expect(screen.getByLabelText('Die 2: 5, re-rolled')).toBeInTheDocument();
  rerender(<DiceTray dice={[{ value: 6, sides: 6 }]} rollKey="r2" />);
  expect(screen.queryByLabelText('Die 1: 6')).toBeNull();
  act(() => void vi.advanceTimersByTime(650));
  expect(screen.getByLabelText('Die 1: 6')).toBeInTheDocument();

  motion(true);
  render(<DiceTray dice={[{ value: 2, sides: 6 }]} rollKey="r3" />);
  expect(screen.getByLabelText('Die 1: 2')).toBeInTheDocument();
});

test('dice can be picked when the tray allows it, and show hits and misses', () => {
  motion(true);
  const onToggle = vi.fn();
  render(<DiceTray dice={dice} rollKey="r1" selected={[1]} onToggle={onToggle} judge={(d) => d.value >= 4} />);
  const second = screen.getByRole('button', { name: 'Die 2: 5, re-rolled, success' });
  expect(second).toHaveAttribute('aria-pressed', 'true');
  screen.getByRole('button', { name: 'Die 1: 3, fail' }).click();
  expect(onToggle).toHaveBeenCalledWith(0);
});

test('sorted dice show high to low, ties in rolled order, and toggle their original index', async () => {
  motion(true);
  const onToggle = vi.fn();
  render(<DiceTray dice={[{ value: 2, sides: 6 }, { value: 6, sides: 6 }, { value: 2, sides: 6 }, { value: 4, sides: 6 }]} rollKey="r" order="high-first" onToggle={onToggle} />);
  const shown = within(screen.getByRole('group', { name: 'Dice' })).getAllByRole('button');
  expect(shown.map((b) => b.getAttribute('aria-label'))).toEqual(['Die 2: 6', 'Die 4: 4', 'Die 1: 2', 'Die 3: 2']);
  await userEvent.click(shown[0]);
  expect(onToggle).toHaveBeenCalledWith(1);
  await userEvent.click(shown[3]);
  expect(onToggle).toHaveBeenLastCalledWith(2);
});

test('by default dice stay in the order rolled (Learn drills)', () => {
  motion(true);
  render(<DiceTray dice={[{ value: 2, sides: 6 }, { value: 6, sides: 6 }]} rollKey="r" />);
  expect(within(screen.getByRole('group', { name: 'Dice' })).getAllByLabelText(/^Die/).map((d) => d.textContent)).toEqual(['2', '6']);
});

test('a changed die is marked with an icon, not an emoji', () => {
  motion(true);
  render(<DiceTray dice={[{ value: 5, sides: 6, replaced: true }]} rollKey="r" />);
  const die = screen.getByLabelText('Die 1: 5, changed');
  expect(die.textContent).not.toContain('✎');
  expect(die.querySelector('svg')).not.toBeNull();
});
