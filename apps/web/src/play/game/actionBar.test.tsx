import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ActionSlotProvider, PinAction } from './actionBar';

test('PinAction without a slot renders inline (Learn drills)', () => {
  const { container } = render(
    <div data-testid="panel">
      <PinAction slot="end">
        <button>End Command phase</button>
      </PinAction>
    </div>,
  );
  expect(within(screen.getByTestId('panel')).getByRole('button', { name: 'End Command phase' })).toBeInTheDocument();
  expect(container.innerHTML).toBe('<div data-testid="panel"><button>End Command phase</button></div>');
});

test('with a slot, pinned buttons go to the Actions bar, main first', () => {
  render(
    <ActionSlotProvider>
      <PinAction slot="end">
        <button>End Shooting phase</button>
      </PinAction>
      <PinAction slot="main">
        <button>Shoot</button>
      </PinAction>
    </ActionSlotProvider>,
  );
  const bar = screen.getByRole('group', { name: 'Actions' });
  expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Shoot', 'End Shooting phase']);
});

test('a pinned button keeps its handler and leaves the bar when its panel goes', async () => {
  function Panel() {
    const [n, setN] = useState(0);
    return n < 1 ? (
      <PinAction slot="main">
        <button onClick={() => setN(1)}>Accept</button>
      </PinAction>
    ) : (
      <p>Accepted</p>
    );
  }
  render(
    <ActionSlotProvider>
      <Panel />
    </ActionSlotProvider>,
  );
  await userEvent.click(within(screen.getByRole('group', { name: 'Actions' })).getByRole('button', { name: 'Accept' }));
  expect(screen.getByText('Accepted')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Actions' })).queryAllByRole('button')).toHaveLength(0);
});
