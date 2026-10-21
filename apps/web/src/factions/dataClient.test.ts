import { afterEach, describe, expect, test, vi } from 'vitest';
import { stubGeneratedData } from '../lists/__fixtures__/generatedData';
import { getCatalogue, getPolicy, getRosterFile, getRosterScope, resetDataCache } from './dataClient';
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

describe('roster data', () => {
  const requested = (fetchMock: ReturnType<typeof stubGeneratedData>) => fetchMock.mock.calls.map((c) => String(c[0]));

  test('getRosterScope(["necrons"]) fetches the necrons and system roster files once each, however often it is asked', async () => {
    const fetchMock = stubGeneratedData();
    const a = await getRosterScope(['necrons']);
    const b = await getRosterScope(['necrons']);
    expect(b).toBe(a);
    const urls = requested(fetchMock);
    expect(urls.filter((u) => u === '/data/roster/necrons.json')).toHaveLength(1);
    expect(urls.filter((u) => u === '/data/roster/system.json')).toHaveLength(1);
    expect(urls.filter((u) => u.startsWith('/data/roster/'))).toHaveLength(2);
    expect(a.files.map((f) => f.slug)).toEqual(['necrons', 'system']);
    expect(a.system.slug).toBe('system');
  });

  test('two Aeldari catalogues share one fetch of the Aeldari Library; the scope is the union, primary first, system last', async () => {
    const fetchMock = stubGeneratedData();
    const scope = await getRosterScope(['aeldari-craftworlds', 'aeldari-harlequins']);
    const slugs = scope.files.map((f) => f.slug);
    expect(slugs[0]).toBe('aeldari-craftworlds');
    expect(slugs).toContain('aeldari-harlequins');
    expect(slugs.at(-1)).toBe('system');
    expect(new Set(slugs).size).toBe(slugs.length);
    const urls = requested(fetchMock).filter((u) => u.startsWith('/data/roster/'));
    expect(urls.filter((u) => u === '/data/roster/aeldari-aeldari-library.json')).toHaveLength(1);
    expect(urls).toHaveLength(new Set(urls).size);
  });

  test('getRosterFile and getPolicy fetch from /data/roster and cache', async () => {
    const fetchMock = stubGeneratedData();
    const file = await getRosterFile('necrons');
    expect(file.slug).toBe('necrons');
    expect(await getRosterFile('necrons')).toBe(file);
    const policy = await getPolicy();
    expect(policy.aooAllies.length).toBeGreaterThan(0);
    expect(await getPolicy()).toBe(policy);
    expect(requested(fetchMock)).toEqual(['/data/roster/necrons.json', '/data/roster/policy.json']);
  });

  test('an unknown catalogue slug is a readable error that is not cached', async () => {
    stubGeneratedData();
    await expect(getRosterScope(['no-such-faction'])).rejects.toThrow('no-such-faction');
    await expect(getRosterScope(['no-such-faction'])).rejects.toThrow('no-such-faction');
    await expect(getRosterScope(['necrons'])).resolves.toBeDefined();
  });
});
