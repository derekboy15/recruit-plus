import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { PageHeader } from './PageHeader';

test('a sub-page header has Back to its parent, the title as h1 and its actions', () => {
  render(
    <MemoryRouter>
      <PageHeader title="Novokh Incursion" subtitle="Necrons · Incursion" back={{ to: '/build', label: 'Your lists' }} actions={<button>Play</button>} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Back to Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeInTheDocument();
  expect(screen.getByText('Necrons · Incursion')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  expect(document.querySelector('header.page-head')).toHaveClass('page-head--sub');
});

test('a top-level header has no Back', () => {
  render(
    <MemoryRouter>
      <PageHeader variant="top" title="Your lists" />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('link', { name: /^Back to/ })).toBeNull();
  expect(screen.getByRole('banner', { hidden: true }) ?? document.querySelector('.page-head--top')).toBeTruthy();
  expect(document.querySelector('header.page-head')).toHaveClass('page-head--top');
});

test('long titles are clipped, not wrapped', () => {
  render(
    <MemoryRouter>
      <PageHeader title={'x'.repeat(200)} back={{ to: '/', label: 'Home' }} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('page-head__title');
}); // .page-head__title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis } is checked at 320px in Task 10
