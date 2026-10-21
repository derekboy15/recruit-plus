import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

test('vercel.json is valid JSON with an SPA fallback and the data build', () => {
  const config = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'vercel.json'), 'utf8'));
  expect(config.buildCommand).toContain('data:build');
  expect(config.outputDirectory).toBe('apps/web/dist');
  expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
});
