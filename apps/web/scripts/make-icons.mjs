/**
 * Renders public/icon.svg to the PNG icons the manifest and iOS need, using Playwright's Chromium:
 * - icon-192.png, icon-512.png: the icon as drawn (its own rounded dark tile, transparent corners);
 * - icon-maskable-512.png: a full-bleed #121212 square with the glyph at 80%, inside the maskable safe zone;
 * - apple-touch-icon.png: 180×180, opaque #121212 with the glyph at 80% (iOS adds its own rounding).
 * The PNGs are committed; rerun only when the SVG changes:  npm run icons -w apps/web
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const pub = join(import.meta.dirname, '..', 'public');
const svg = readFileSync(join(pub, 'icon.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1, background: 'transparent' },
  { file: 'icon-512.png', size: 512, scale: 1, background: 'transparent' },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.8, background: '#121212' },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.8, background: '#121212' },
];

const browser = await chromium.launch();
try {
  for (const { file, size, scale, background } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const glyph = Math.round(size * scale);
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${background}">` +
        `<img src="${dataUrl}" width="${glyph}" height="${glyph}"></body></html>`,
    );
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: join(pub, file), omitBackground: background === 'transparent' });
    await page.close();
    console.log(`wrote public/${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
