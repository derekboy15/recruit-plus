import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, test } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { AppRoutes } from '../routes';

let path = '';
function Where() {
  path = useLocation().pathname;
  return null;
}

test('an unknown URL shows Page not found and stays put', () => {
  render(
    <AuthProvider backend={null}>
      <MemoryRouter initialEntries={['/no-such-page']}>
        <AppRoutes />
        <Where />
      </MemoryRouter>
    </AuthProvider>,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  expect(screen.getByText('That page doesn’t exist. It may have moved, or the link is wrong.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.queryByRole('link', { name: /^Back to/ })).toBeNull();
  expect(path).toBe('/no-such-page');
});
