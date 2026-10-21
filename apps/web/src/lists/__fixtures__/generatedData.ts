import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';

const GENERATED = join(__dirname, '..', '..', '..', '..', '..', 'packages', 'data', 'generated');

/**
 * Test-only: stubs global `fetch` so `/data/...` is served from the generated faction data
 * (`npm run data:fetch && npm run data:build`), the same files the deployed site serves.
 * Returns the mock so tests can count the requests made.
 */
export function stubGeneratedData() {
  if (!existsSync(join(GENERATED, 'index.json'))) throw new Error(`${GENERATED} is missing: run npm run data:build`);
  const fetchMock = vi.fn(async (url: string) => {
    const file = join(GENERATED, ...url.replace(/^\/data\//, '').split('/'));
    if (!url.startsWith('/data/') || !existsSync(file)) return new Response('not found', { status: 404 });
    return new Response(readFileSync(file, 'utf8'));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
