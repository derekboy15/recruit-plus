import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TestProviders } from '../rules/__fixtures__/TestProviders';
import { openDb } from '../storage/db';
import { mission } from './__fixtures__/missions';
import { MissionMap } from './MissionMap';
import { MissionRules } from './MissionRules';

test('renders one circle per objective', () => {
  const m = mission('aoo-desperate-raid');
  const { container } = render(<MissionMap map={m.map} />);
  expect(container.querySelectorAll('[data-objective]')).toHaveLength(6);
  expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 44 30');
});

test('aria-label names zones and objective count', () => {
  render(<MissionMap map={mission('aoo-desperate-raid').map} players={{ A: 'You', B: 'Opponent' }} />);
  const img = screen.getByRole('img');
  expect(img).toHaveAccessibleName(/44" × 30" battlefield/);
  expect(img).toHaveAccessibleName(/You \(Player A\) deploys along the left edge/);
  expect(img).toHaveAccessibleName(/Opponent \(Player B\) deploys along the right edge/);
  expect(img).toHaveAccessibleName(/6 objective markers/);
});

test('circle exclude renders as an SVG mask', () => {
  const { container } = render(<MissionMap map={mission('aoo-cleanse-the-land').map} />);
  const masks = container.querySelectorAll('mask');
  expect(masks.length).toBe(2);
  expect(masks[0].querySelector('circle')).not.toBeNull();
  expect(container.querySelector('[data-zone="A"]')!.getAttribute('mask')).toMatch(/^url\(#/);
});

test('polygon zones and named areas are drawn', () => {
  const { container } = render(<MissionMap map={mission('cb-pathway-to-glory').map} />);
  expect(container.querySelector('[data-area="search-area"]')).not.toBeNull();
  const sg = render(<MissionMap map={mission('aoo-sacred-ground').map} />);
  expect(sg.container.querySelector('[data-zone="A"] polygon')).not.toBeNull();
});

test('highlight marks one zone', () => {
  const { container } = render(<MissionMap map={mission('aoo-desperate-raid').map} highlight="B" />);
  expect(container.querySelector('[data-zone="B"]')!.getAttribute('class')).toMatch(/highlight/);
  expect(container.querySelector('[data-zone="A"]')!.getAttribute('class')).not.toMatch(/highlight/);
});

test('MissionRules shows the rules, the primary and Not confirmed notes', () => {
  render(<TestProviders db={openDb('mission-rules')} router={false}><MissionRules mission={mission('aoo-deliverance')} /></TestProviders>);
  expect(screen.getByRole('heading', { name: 'Drop Zone Repleted' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Primary: Secure Landing Sites/ })).toBeInTheDocument();
  expect(screen.getAllByText(/^Not confirmed:/).length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText(/Two objective markers are taken off the battlefield/)).toBeInTheDocument();
});
