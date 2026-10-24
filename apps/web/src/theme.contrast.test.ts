/**
 * Dark-theme contrast (WCAG 2.1): text ≥ 4.5:1; focus rings and input borders ≥ 3:1. Values are read from theme.css,
 * so editing a token re-runs the check.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(join(__dirname, 'theme.css'), 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root);
  if (!m) throw new Error(`--${name} isn't a hex colour in :root`);
  return m[1];
};
const rule = (selector: string, prop: string): string => {
  const block = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const m = new RegExp(`(?:^|[;\\s])${prop}:[^;]*?(#[0-9a-fA-F]{6}|var\\(--[a-z-]+\\))`).exec(block);
  if (!m) throw new Error(`${selector} has no ${prop}`);
  return m[1].startsWith('var(') ? token(m[1].slice(6, -1)) : m[1];
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe('contrast', () => {
  test('known pair', () => expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0));

  const text: [string, () => string, () => string][] = [];
  for (const fg of ['text', 'text-soft', 'text-muted', 'brass-strong', 'danger-text', 'ok', 'warn'])
    for (const bg of ['bg', 'surface', 'surface-2']) text.push([`--${fg} on --${bg}`, () => token(fg), () => token(bg)]);
  text.push(['#ffffff on --red', () => '#ffffff', () => token('red')]);
  text.push(["selected .chip text on --brass-strong", () => rule(".chip[aria-pressed='true']", 'color'), () => token('brass-strong')]);
  text.push(
    ['--bad on --bad-bg', () => token('bad'), () => token('bad-bg')],
    ['--ok on --ok-bg', () => token('ok'), () => token('ok-bg')],
    ['.badge--legends on --surface', () => rule('.badge--legends', 'color'), () => token('surface')],
    ['.badge--fw on --surface', () => rule('.badge--fw', 'color'), () => token('surface')],
    ['button text on .btn--primary', () => token('text'), () => rule('.btn--primary', 'background')],
  );
  test.each(text)('%s ≥ 4.5', (_, fg, bg) => expect(contrast(fg(), bg())).toBeGreaterThanOrEqual(4.5));
  test('auth errors are not red-strong text', () => expect(rule('.auth-form__error', 'color')).toBe(token('danger-text')));

  test.each([
    ['--focus on --bg', () => token('focus'), () => token('bg')],
    ['--focus on --surface', () => token('focus'), () => token('surface')],
    ['.input border on --surface-2', () => rule('.input', 'border'), () => token('surface-2')],
  ] as [string, () => string, () => string][])('%s ≥ 3', (_, fg, bg) => expect(contrast(fg(), bg())).toBeGreaterThanOrEqual(3));
});
