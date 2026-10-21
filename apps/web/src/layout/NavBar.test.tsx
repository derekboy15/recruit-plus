import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './NavBar';

test('shows the five sections in order with the active one marked', () => {
  render(
    <MemoryRouter initialEntries={['/build']}>
      <NavBar />
    </MemoryRouter>,
  );
  const links = screen.getAllByRole('link');
  expect(links.map((l) => l.querySelector('.nav__label')?.textContent)).toEqual(['Learn', 'Build', 'Play', 'Table', 'Rules']);
  expect(links.map((l) => l.getAttribute('href'))).toEqual(['/learn', '/build', '/play', '/table', '/rules']);
  expect(screen.getByRole('link', { name: 'Build' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Learn' })).not.toHaveAttribute('aria-current');
});
