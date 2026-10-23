import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { DISCLAIMER, Footer } from '../layout/Footer';
import { AppRoutes } from '../routes';
import { Privacy } from './Privacy';
import { Terms } from './Terms';

const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Privacy', () => {
  test('privacy lists what is stored', () => {
    inRouter(<Privacy contact="ops@example.org" />);
    expect(screen.getByRole('heading', { name: 'Privacy', level: 1 })).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const thing of ['email', 'army lists', 'saved games', 'lesson progress', 'rules-error reports']) expect(text).toContain(thing);
  });

  test('privacy shows the contact email when set', () => {
    inRouter(<Privacy contact="ops@example.org" />);
    expect(screen.getByRole('link', { name: 'ops@example.org' })).toHaveAttribute('href', 'mailto:ops@example.org');
  });

  test('privacy without contact says it is added at publish', () => {
    inRouter(<Privacy contact="" />);
    expect(screen.getByText('The contact address is added when the site is published.')).toBeInTheDocument();
  });
});

describe('Terms', () => {
  test('terms carry the disclaimer verbatim', () => {
    inRouter(<Terms />);
    expect(screen.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });
});

test('footer links Legal & credits, Privacy and Terms', () => {
  inRouter(<Footer />);
  expect(screen.getByRole('link', { name: 'Legal & credits' })).toHaveAttribute('href', '/legal');
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
});

test.each([
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms of use'],
])('%s is public', (path, title) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes guard={() => <p>Sign in first</p>} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
  expect(screen.queryByText('Sign in first')).toBeNull();
});
