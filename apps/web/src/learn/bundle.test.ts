/**
 * The Learn pages load without the engine and the board: they come only with the drill screens and "Your first game"
 * (lazily). Walks the static (non-type) imports from the Learn routes and fails if they reach either.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const STATIC_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm;
const HEAVY = ['@recruit/engine', '@recruit/engine/data', 'pixi.js'];

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const f of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(f) && !f.endsWith('.css') && /\.tsx?$/.test(f)) return f;
  return null;
}

/** Every heavy package reached from `entry` by static imports, with the file that imports it. */
function heavyImports(entry: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(STATIC_IMPORT)) {
      const spec = m[1];
      if (HEAVY.includes(spec)) found.push(`${file.replace(/.*[\/]src[\/]/, 'src/')} → ${spec}`);
      else if (spec.startsWith('.')) {
        const next = resolveFile(file, spec);
        if (next) visit(next);
      }
    }
  };
  visit(entry);
  return found;
}

test('the Learn home, lesson pages and first-game page load without the engine or the board', () => {
  expect(heavyImports(join(__dirname, 'LearnRoutes.tsx'))).toEqual([]);
});
