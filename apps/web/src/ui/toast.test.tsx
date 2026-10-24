import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ToastProvider, useToast, type ToastInput } from './toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

let show: (t: ToastInput) => void;
function Grab() {
  show = useToast().show;
  return null;
}
const setup = () =>
  render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );

test('shows the message and Undo, and Undo runs once', () => {
  setup();
  const onAction = vi.fn();
  act(() => show({ message: 'Deleted “Novokh Incursion”', action: { label: 'Undo', onAction } }));
  expect(screen.getByRole('status')).toHaveTextContent('Deleted “Novokh Incursion”');
  const undo = screen.getByRole('button', { name: 'Undo' });
  fireEvent.click(undo);
  fireEvent.click(undo);
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Deleted/)).toBeNull();
});

test('disappears after 6 seconds by default', () => {
  setup();
  act(() => show({ message: 'Deleted “Novokh Incursion”' }));
  act(() => vi.advanceTimersByTime(5999));
  expect(screen.getByText(/Deleted/)).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText(/Deleted/)).toBeNull();
});

test('durationMs overrides the default', () => {
  setup();
  act(() => show({ message: 'Saved', durationMs: 2000 }));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.queryByText('Saved')).toBeNull();
});

test('a second toast replaces the first; the first Undo is gone', () => {
  setup();
  const a = vi.fn();
  const b = vi.fn();
  act(() => show({ message: 'Deleted “A”', action: { label: 'Undo', onAction: a } }));
  act(() => vi.advanceTimersByTime(4000));
  act(() => show({ message: 'Deleted “B”', action: { label: 'Undo', onAction: b } }));
  expect(screen.queryByText('Deleted “A”')).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
  // The first toast's timer was cleared: B still gets its full 6 seconds.
  act(() => vi.advanceTimersByTime(2500));
  expect(screen.getByText('Deleted “B”')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(b).toHaveBeenCalledTimes(1);
  expect(a).not.toHaveBeenCalled();
});

test('Dismiss closes it without the action', () => {
  setup();
  const onAction = vi.fn();
  act(() => show({ message: 'Deleted “A”', action: { label: 'Undo', onAction } }));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText('Deleted “A”')).toBeNull();
  expect(onAction).not.toHaveBeenCalled();
});

test('the region is a polite live region that is always there', () => {
  setup();
  const region = screen.getByRole('status');
  expect(region).toHaveAttribute('aria-live', 'polite');
  expect(region).toHaveClass('toast-region');
});

test('it stays while focus is inside it, then gets a fresh 6 seconds', () => {
  setup();
  act(() => show({ message: 'Deleted “A”', action: { label: 'Undo', onAction: () => {} } }));
  act(() => screen.getByRole('button', { name: 'Undo' }).focus());
  act(() => vi.advanceTimersByTime(10_000));
  expect(screen.getByText('Deleted “A”')).toBeInTheDocument();
  act(() => screen.getByRole('button', { name: 'Undo' }).blur());
  act(() => vi.advanceTimersByTime(5999));
  expect(screen.getByText('Deleted “A”')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText('Deleted “A”')).toBeNull();
});

test('useToast outside a provider throws', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => renderHook(useToast)).toThrow('useToast needs a ToastProvider');
});
