import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { DrillCard } from './DrillCard';
import type { CardView } from './types';

const view = (dice?: CardView['dice']): CardView => ({
  intro: 'Intro',
  results: [],
  status: 'playing',
  failure: null,
  wrong: null,
  stage: { kind: 'ask', id: 'hits', question: 'How many of these dice hit?', choices: [{ id: '1', label: '1' }] },
  ...(dice ? { dice } : {}),
});

describe('DrillCard', () => {
  test('a question about a roll shows its dice, without saying which pass', async () => {
    render(
      <MemoryRouter>
        <DrillCard view={view({ key: 'r1', dice: [{ value: 6, sides: 6 }, { value: 2, sides: 6 }] })} onAnswer={vi.fn()} onRestart={vi.fn()} sheet={null} next={null} />
      </MemoryRouter>,
    );
    const tray = within(screen.getByRole('region', { name: 'Drill' })).getByRole('group', { name: 'Dice' });
    await waitFor(() => expect(within(tray).getByLabelText('Die 1: 6')).toBeInTheDocument());
    expect(within(tray).getByLabelText('Die 2: 2')).toBeInTheDocument();
    expect(tray.innerHTML).not.toMatch(/success|fail/);
  });
});
