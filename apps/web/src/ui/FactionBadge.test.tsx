import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FactionBadge, factionInitials } from './FactionBadge';

test('initials: one word gives three letters, several give the first letters of two', () => {
  expect(factionInitials('Necrons')).toBe('NEC');
  expect(factionInitials('Space Marines')).toBe('SM');
  expect(factionInitials('Orks')).toBe('ORK');
  expect(factionInitials("T'au Empire")).toBe('TE');
  expect(factionInitials('Leagues of Votann')).toBe('LV');
  expect(factionInitials('The Lost and the Damned')).toBe('LA');
  expect(factionInitials("T'au")).toBe('TAU');
});

test('the badge is aria-hidden and shows the initials', () => {
  const { container } = render(<FactionBadge slug="necrons" name="Necrons" />);
  const badge = container.querySelector('.faction-badge')!;
  expect(badge.tagName).toBe('SPAN');
  expect(badge).toHaveAttribute('aria-hidden', 'true');
  expect(badge).toHaveTextContent('NEC');
  expect(badge).toHaveClass('faction-badge--md');
});

test('the tint follows the faction group', () => {
  const tint = (slug: string) => {
    const { container } = render(<FactionBadge slug={slug} name="X" size="sm" />);
    const el = container.querySelector<HTMLElement>('.faction-badge')!;
    return [el.style.backgroundColor, el.style.color];
  };
  expect(tint('necrons')).toEqual(['rgb(31, 51, 40)', 'rgb(143, 209, 156)']);
  expect(tint('aeldari-craftworlds')).toEqual(['rgb(31, 51, 40)', 'rgb(143, 209, 156)']);
  expect(tint('imperium-space-marines')).toEqual(['rgb(29, 42, 64)', 'rgb(156, 194, 240)']);
  expect(tint('chaos-death-guard')).toEqual(['rgb(58, 29, 34)', 'rgb(240, 160, 166)']);
  expect(tint('fallen')).toEqual(['rgb(58, 29, 34)', 'rgb(240, 160, 166)']);
  expect(tint('orks')).toEqual(['rgb(51, 48, 26)', 'rgb(220, 203, 106)']);
  expect(tint('unaligned-monsters-and-gribblies')).toEqual(['var(--surface-2)', 'var(--text)']);
});

test('sizes', () => {
  const { container } = render(<FactionBadge slug="orks" name="Orks" size="sm" />);
  expect(container.querySelector('.faction-badge')).toHaveClass('faction-badge--sm');
});
