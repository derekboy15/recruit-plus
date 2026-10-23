import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../../lists/__fixtures__/generatedData';
import type { RendererFactory } from '../../play/board/BoardCanvas';
import { WordingProvider } from '../../rules/wording';
import { tiny } from '../__fixtures__/drills';
import { DrillScreen } from './DrillScreen';

const fakeRenderer: RendererFactory = async () => ({ draw: () => {}, resize: () => {}, destroy: () => {} });
const css = readFileSync(join(__dirname, '..', 'learn.css'), 'utf8');

beforeEach(() => {
  resetDataCache();
  stubGeneratedData();
});
afterEach(() => vi.unstubAllGlobals());

const show = (onDone = vi.fn()) =>
  render(
    <WordingProvider initial="plain">
      <MemoryRouter>
        <DrillScreen drill={tiny} onDone={onDone} exitTo="/learn/tiny" renderer={fakeRenderer} seed={1} />
      </MemoryRouter>
    </WordingProvider>,
  );
const card = () => screen.getByRole('region', { name: 'Drill' });
const cpNow = '3'; // deployedGame: 3 Core Book CP, +1 in A's Command phase → asserted by the right-answer test

describe('DrillScreen', () => {
  test('shows the intro and the first stage, then the question with 44px choices', async () => {
    show();
    expect(await screen.findByText('A test drill.')).toBeInTheDocument();
    const q = within(card()).getByRole('group', { name: 'How many CP do you have?' });
    expect(within(q).getAllByRole('radio')).toHaveLength(3);
    expect(css).toMatch(/\.drill-card__choice[^}]*min-height: var\(--touch\)/);
  });

  test('a right answer moves on; a wrong one explains and stays', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('A test drill.');
    await user.click(within(card()).getByRole('radio', { name: `${cpNow} CP` }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    expect(within(card()).getByRole('alert')).toHaveTextContent('Not quite. You have 4 CP.');
    await user.click(within(card()).getByRole('radio', { name: '4 CP' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    expect(within(card()).getByText('You have 4 CP.')).toBeInTheDocument();
    expect(within(card()).getByText('End your Command phase.')).toBeInTheDocument();
  });

  test('the phase panel is hidden while a question is open', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('A test drill.');
    expect(screen.queryByRole('button', { name: 'End Command phase' })).toBeNull();
    await user.click(within(card()).getByRole('radio', { name: '4 CP' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    expect(screen.getByRole('button', { name: 'End Command phase' })).toBeInTheDocument();
  });

  test('finishing calls onDone once and shows every explanation', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    show(onDone);
    await screen.findByText('A test drill.');
    await user.click(within(card()).getByRole('radio', { name: '4 CP' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    await user.click(screen.getByRole('button', { name: 'End Command phase' }));
    expect(within(card()).getByRole('heading', { name: 'Drill complete' })).toBeInTheDocument();
    expect(within(card()).getByText('You have 4 CP.')).toBeInTheDocument();
    expect(within(card()).getByText('On to the Movement phase.')).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(0);
    expect(screen.queryByRole('button', { name: /^End / })).toBeNull();
  });

  test('Start again builds a fresh run', async () => {
    const user = userEvent.setup();
    show();
    await screen.findByText('A test drill.');
    await user.click(within(card()).getByRole('radio', { name: '4 CP' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    await user.click(screen.getByRole('button', { name: 'Start again' }));
    expect(within(card()).getByRole('group', { name: 'How many CP do you have?' })).toBeInTheDocument();
  });

  test('reloading mid-drill starts it again from the beginning', async () => {
    const user = userEvent.setup();
    const first = show();
    await screen.findByText('A test drill.');
    await user.click(within(card()).getByRole('radio', { name: '4 CP' }));
    await user.click(within(card()).getByRole('button', { name: 'Check answer' }));
    first.unmount();
    show();
    expect(await screen.findByRole('group', { name: 'How many CP do you have?' })).toBeInTheDocument();
  });

  test('a data load failure offers to try again', async () => {
    const user = userEvent.setup();
    const real = globalThis.fetch;
    let calls = 0;
    vi.stubGlobal('fetch', (url: string) => (calls++ === 0 ? Promise.resolve(new Response('nope', { status: 500 })) : real(url)));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t be set up/i);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('A test drill.')).toBeInTheDocument();
  });
});
