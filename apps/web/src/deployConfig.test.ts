import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = join(__dirname, '..', '..', '..');
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

/** Vercel's path patterns are path-to-regexp with regex groups; these tests only need the group forms used here. */
const matches = (source: string, path: string) => new RegExp(`^${source}$`).test(path);

test('vercel.json is valid JSON with the data build', () => {
  expect(vercel.buildCommand).toContain('data:build');
  expect(vercel.outputDirectory).toBe('apps/web/dist');
});

describe('rewrites', () => {
  const spa = vercel.rewrites.find((r: { destination: string }) => r.destination === '/index.html');

  test('app routes fall back to index.html', () => {
    for (const path of ['/', '/build/123', '/factions/necrons/units/necron-warriors', '/privacy']) expect(matches(spa.source, path), path).toBe(true);
  });

  test('data and assets are not rewritten to index.html', () => {
    for (const path of ['/data/x.json', '/data/catalogues/necrons.json', '/assets/a.js', '/sw.js', '/workbox-abc.js', '/manifest.webmanifest', '/offline.html']) {
      expect(matches(spa.source, path), path).toBe(false);
    }
  });
});

describe('headers', () => {
  const headersFor = (path: string): Record<string, string> =>
    Object.fromEntries(
      vercel.headers
        .filter((h: { source: string }) => matches(h.source, path))
        .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers.map((x) => [x.key, x.value])),
    );

  test('sw.js is never cached', () => {
    expect(headersFor('/sw.js')['Cache-Control']).toBe('no-cache');
  });

  test('hashed assets are cached for a year, data revalidates', () => {
    expect(headersFor('/assets/index-abc.js')['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(headersFor('/data/rules.json')['Cache-Control']).toBe('public, max-age=0, must-revalidate');
  });

  test('every response carries the basic security headers', () => {
    const h = headersFor('/build/123');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toContain('camera=()');
  });
});

test('CI runs the production build, budgets and both e2e suites', () => {
  const ci = read('.github', 'workflows', 'ci.yml');
  const at = (s: string) => {
    const i = ci.indexOf(s);
    expect(i, s).toBeGreaterThan(-1);
    return i;
  };
  expect(at('npm test')).toBeLessThan(at('npm run build'));
  expect(at('npm run build')).toBeLessThan(at('npm run budgets -w apps/web'));
  expect(at('npm run budgets -w apps/web')).toBeLessThan(at('npm run e2e'));
});

test('DEPLOY.md names every VITE_ variable used in src', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  const used = new Set(walk(join(ROOT, 'apps', 'web', 'src')).filter((f) => /\.(ts|tsx)$/.test(f)).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bVITE_[A-Z_]+/g)].map((m) => m[0])));
  expect(used.size).toBeGreaterThan(2);
  const deploy = read('DEPLOY.md');
  for (const v of used) expect(deploy, v).toContain(v);
});
