/** The type faces and button variants the mockups use (spec §2), read straight from theme.css. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const css = readFileSync(join(__dirname, 'theme.css'), 'utf8');

test('fonts are the display and body faces', () => {
  expect(css).toMatch(/--font-display:\s*'Barlow Condensed'/);
  expect(css).toMatch(/--font-body:\s*Inter/);
  expect(css).toMatch(/:root\s*\{[^}]*font-family:\s*var\(--font-body\)/);
});

test('button variants exist', () => {
  for (const cls of ['.btn--primary', '.btn--tertiary', '.btn--danger', '.btn--icon']) expect(css).toContain(`${cls} {`);
});
