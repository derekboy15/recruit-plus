import { afterEach, expect, test, vi } from 'vitest';
import { getCatalogue, resetDataCache } from './dataClient';
import { necrons } from './__fixtures__/necrons';

afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

test('getCatalogue fetches /data/catalogues/<slug>.json once and caches it', async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(necrons)));
  vi.stubGlobal('fetch', fetchMock);
  const a = await getCatalogue('necrons');
  const b = await getCatalogue('necrons');
  expect(a.name).toBe('Necrons');
  expect(b).toBe(a);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/data/catalogues/necrons.json');
});

test('getCatalogue rejects on HTTP errors so the page can show a message', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
  await expect(getCatalogue('missing')).rejects.toThrow('404');
});
