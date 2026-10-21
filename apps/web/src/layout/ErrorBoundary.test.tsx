import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => {
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error('Failed to fetch dynamically imported module');
}

test('a page that fails to load shows a message and a Reload button instead of a blank app', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the caught error
  const reload = vi.fn();
  render(
    <ErrorBoundary onReload={reload}>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this page.");
  const button = screen.getByRole('button', { name: 'Reload' });
  expect(button).toHaveClass('btn'); // .btn: min-height var(--touch), 44px
  await userEvent.setup().click(button);
  expect(reload).toHaveBeenCalledTimes(1);
});

test('a new page path clears the error and tries again', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { rerender } = render(
    <ErrorBoundary resetKey="/build">
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toBeInTheDocument();
  rerender(
    <ErrorBoundary resetKey="/build/new">
      <p>New list</p>
    </ErrorBoundary>,
  );
  expect(screen.getByText('New list')).toBeInTheDocument();
});

test('children that render fine are shown as they are', () => {
  render(
    <ErrorBoundary>
      <p>All good</p>
    </ErrorBoundary>,
  );
  expect(screen.getByText('All good')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
