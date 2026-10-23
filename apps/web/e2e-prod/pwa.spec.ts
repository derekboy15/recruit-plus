/** Installability: the manifest, its PNG icons and the apple-touch-icon, as Chromium judges them. */
import { expect, test } from './fixtures';
import { waitForServiceWorker } from './helpers';

interface ManifestIcon { src: string; sizes: string; type: string; purpose?: string }

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): [number, number] {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('manifest is installable', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  const icons = manifest.icons as ManifestIcon[];
  const png = icons.filter((i) => i.type === 'image/png');
  expect(png.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(icons.some((i) => i.purpose?.split(' ').includes('maskable'))).toBe(true);
  for (const icon of png) {
    const res = await request.get(`/${icon.src.replace(/^\//, '')}`);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const [w, h] = pngSize(await res.body());
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
  }
});

test('Chromium reports no installability errors', async ({ page }) => {
  await page.goto('/');
  await waitForServiceWorker(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('apple-touch-icon is linked and served', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(href).toBe('/apple-touch-icon.png');
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(pngSize(await res.body())).toEqual([180, 180]);
});
