import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InfoFile } from '@recruit/data/model';
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

/**
 * Test-only: serves `/data/info/<slug>.json` with every `plain` removed (rules and profiles), so a test can pin the
 * official-wording fallback whatever plain English has been written since. Every other URL is served as before.
 */
export function withoutInfoPlain(fetchMock: ReturnType<typeof stubGeneratedData>, slug: string): void {
  const served = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string) => {
    const res = await served(url);
    if (url !== `/data/info/${slug}.json` || !res.ok) return res;
    const file = (await res.json()) as InfoFile;
    for (const info of Object.values(file.entries)) {
      for (const r of info.rules ?? []) delete r.plain;
      for (const p of info.profiles ?? []) delete p.plain;
    }
    return new Response(JSON.stringify(file));
  });
}
