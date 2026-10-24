import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { Sheet } from './Sheet';

test('focuses its heading when opened', () => {
  render(<Sheet title="Choose a dynasty" onClose={() => {}}>Body</Sheet>);
  const dialog = screen.getByRole('dialog', { name: 'Choose a dynasty' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('heading', { level: 2, name: 'Choose a dynasty' })).toHaveFocus();
});

test('Escape calls onClose', async () => {
  const onClose = vi.fn();
  render(<Sheet title="Preview" onClose={onClose}>Body</Sheet>);
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the backdrop calls onClose', async () => {
  const onClose = vi.fn();
  render(<Sheet title="Preview" closeLabel="Close preview" onClose={onClose}>Body</Sheet>);
  const backdrop = document.querySelector('.sheet-backdrop')!;
  expect(backdrop).toHaveAttribute('aria-label', 'Close preview');
  expect(backdrop).toHaveAttribute('tabindex', '-1');
  await userEvent.click(backdrop);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the close button is an icon button named by closeLabel', async () => {
  const onClose = vi.fn();
  render(<Sheet title="Preview" closeLabel="Close preview" onClose={onClose}>Body</Sheet>);
  const close = screen.getAllByRole('button', { name: 'Close preview' }).find((b) => !b.classList.contains('sheet-backdrop'))!;
  expect(close.querySelector('svg')).not.toBeNull();
  await userEvent.click(close);
  expect(onClose).toHaveBeenCalledTimes(1);
});

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && <Sheet title="Preview" onClose={() => setOpen(false)}>Body</Sheet>}
    </>
  );
}

test('focus goes back to the opener when it closes', async () => {
  render(<Opener />);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('heading', { name: 'Preview' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
});

test('footer is rendered after the content', () => {
  render(
    <Sheet title="Preview" onClose={() => {}} footer={<button>Add to list · 90 pts</button>}>
      <p>Content</p>
    </Sheet>,
  );
  const footer = document.querySelector('.sheet__footer')!;
  expect(footer).toContainElement(screen.getByRole('button', { name: 'Add to list · 90 pts' }));
  expect(screen.getByText('Content').compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('inline has no close button and is not a dialog', () => {
  render(<Sheet title="Army rules" inline onClose={() => {}}>Body</Sheet>);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('region', { name: 'Army rules' })).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
  expect(document.querySelector('.sheet-backdrop')).toBeNull();
});

test('nested sheets close one at a time, the top one first', async () => {
  const outer = vi.fn();
  const inner = vi.fn();
  render(
    <Sheet title="Unit" onClose={outer}>
      <Sheet title="Wargear" onClose={inner}>Body</Sheet>
    </Sheet>,
  );
  await userEvent.keyboard('{Escape}');
  expect(inner).toHaveBeenCalledTimes(1);
  expect(outer).not.toHaveBeenCalled();
});

test('a sheet opened from inside a sticky header renders into body, so it stacks above the tab bar', () => {
  render(
    <header style={{ position: 'sticky', zIndex: 6 }}>
      <Sheet title="Preview" onClose={() => {}}>Body</Sheet>
    </header>,
  );
  expect(screen.getByRole('dialog').parentElement).toBe(document.body);
});

test('opened together with a sheet inside it, the inner sheet keeps focus', () => {
  render(
    <Sheet title="Unit" onClose={() => {}}>
      <Sheet title="Wargear" onClose={() => {}}>Body</Sheet>
    </Sheet>,
  );
  expect(screen.getByRole('heading', { name: 'Wargear' })).toHaveFocus();
});
