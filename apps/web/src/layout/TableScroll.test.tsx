import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TableScroll } from './TableScroll';

test('a wide table scroller is a labelled region that keyboard users can focus and scroll', () => {
  render(
    <TableScroll label="Necron Warriors statline">
      <table />
    </TableScroll>,
  );
  const region = screen.getByRole('region', { name: 'Necron Warriors statline' });
  expect(region).toHaveAttribute('tabindex', '0');
  expect(region).toHaveClass('table-scroll');
});
