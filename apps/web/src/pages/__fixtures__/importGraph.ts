/**
 * Walks the static (non-type) imports from an entry file and lists every heavy package it reaches, with the file that
 * imports it. Bundle tests use it to keep the engine, the roster engine and the board out of pages that load early.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const STATIC_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm;

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const f of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(f) && !f.endsWith('.css') && /\.tsx?$/.test(f)) return f;
  return null;
}

/** Every package in `heavy` reached from `entry` by static imports, as "src/file → package". */
export function heavyImports(entry: string, heavy: string[]): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(STATIC_IMPORT)) {
      const spec = m[1];
      if (heavy.includes(spec)) found.push(`${file.replace(/.*[\/]src[\/]/, 'src/')} → ${spec}`);
      else if (spec.startsWith('.')) {
        const next = resolveFile(file, spec);
        if (next) visit(next);
      }
    }
  };
  visit(entry);
  return found;
}
