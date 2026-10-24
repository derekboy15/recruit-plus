import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { Menu, type MenuItem } from './Menu';
import { Sheet } from './Sheet';

const items = (over: Partial<Record<string, () => void>> = {}): MenuItem[] => [
  { label: 'Play', to: '/build/1/play' },
  { label: 'Duplicate', onSelect: over.duplicate ?? (() => {}) },
  { label: 'Rename', onSelect: () => {} },
  { label: 'Delete', onSelect: () => {}, danger: true },
];

const renderMenu = (list = items(), extra: { header?: string } = {}) =>
  render(
    <MemoryRouter>
      <p>Outside</p>
      <Menu label="Actions for Novokh Incursion" items={list} header={extra.header} />
    </MemoryRouter>,
  );

const trigger = () => screen.getByRole('button', { name: 'Actions for Novokh Incursion' });

test('opens on click and lists the items as menuitems', async () => {
  renderMenu();
  expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  expect(trigger().querySelector('svg')).not.toBeNull();
  expect(screen.queryByRole('menu')).toBeNull();
  await userEvent.click(trigger());
  expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  const menu = screen.getByRole('menu', { name: 'Actions for Novokh Incursion' });
  expect(menu).toBeInTheDocument();
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Play', 'Duplicate', 'Rename', 'Delete']);
  expect(screen.getByRole('menuitem', { name: 'Play' })).toHaveFocus();
});

test('ArrowDown/ArrowUp move focus, Home/End jump', async () => {
  renderMenu();
  await userEvent.click(trigger());
  const item = (name: string) => screen.getByRole('menuitem', { name });
  await userEvent.keyboard('{ArrowDown}');
  expect(item('Duplicate')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(item('Delete')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  expect(item('Play')).toHaveFocus();
  await userEvent.keyboard('{ArrowUp}');
  expect(item('Delete')).toHaveFocus();
  await userEvent.keyboard('{Home}');
  expect(item('Play')).toHaveFocus();
  await userEvent.keyboard('{End}');
  expect(item('Delete')).toHaveFocus();
});

test('Escape closes and returns focus to the trigger', async () => {
  renderMenu();
  await userEvent.click(trigger());
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(trigger()).toHaveFocus();
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
});

test('a click outside closes', async () => {
  renderMenu();
  await userEvent.click(trigger());
  await userEvent.click(screen.getByText('Outside'));
  expect(screen.queryByRole('menu')).toBeNull();
});

test('selecting an item calls onSelect and closes', async () => {
  const duplicate = vi.fn();
  renderMenu(items({ duplicate }));
  await userEvent.click(trigger());
  await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(duplicate).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).toBeNull();
  expect(trigger()).toHaveFocus();
});

test('an item with to is a link', async () => {
  renderMenu();
  await userEvent.click(trigger());
  expect(screen.getByRole('menuitem', { name: 'Play' })).toHaveAttribute('href', '/build/1/play');
});

test('danger items are marked', async () => {
  renderMenu();
  await userEvent.click(trigger());
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('menu__item--danger');
  expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toHaveClass('menu__item--danger');
  expect(screen.getAllByRole('separator')).toHaveLength(1);
});

test('a custom trigger keeps the label as the button name', () => {
  render(
    <MemoryRouter>
      <Menu label="Account" trigger={<svg data-testid="account-icon" />} items={[]} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Account' })).toContainElement(screen.getByTestId('account-icon'));
});

test('a header shows above the items and is not a menu item', async () => {
  renderMenu(items(), { header: 'derek@example.com' });
  await userEvent.click(trigger());
  expect(screen.getByRole('menu')).toHaveTextContent('derek@example.com');
  expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  expect(screen.getByRole('menuitem', { name: 'Play' })).toHaveFocus();
});

test('Escape in a menu inside a sheet closes only the menu', async () => {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <Sheet title="Unit" onClose={onClose}>
        <Menu label="Unit actions" items={items()} />
      </Sheet>
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Unit actions' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
});

test('the menu stays inside the window when its button is near the left edge', async () => {
  const rect = (r: Partial<DOMRect>) => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {}, ...r }) as DOMRect;
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'menu'
      ? rect({ width: 224, height: 200 })
      : rect({ top: 100, bottom: 144, left: 4, right: 48, width: 44, height: 44 });
  });
  renderMenu();
  await userEvent.click(trigger());
  const menu = screen.getByRole('menu');
  expect(menu.style.left).toBe('8px');
  expect(menu.style.top).toBe('148px');
  spy.mockRestore();
});
