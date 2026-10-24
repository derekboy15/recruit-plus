/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // A hand-written service worker (src/sw.ts): precache, offline fallback page, faction data kept as it is used.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Recruit+ 40k 9th',
        short_name: 'Recruit+',
        description: 'Learn, build and play Warhammer 40,000 9th Edition.',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        start_url: '/',
        id: '/',
        scope: '/',
        lang: 'en',
        orientation: 'any',
        categories: ['games', 'education'],
        // PNGs made from icon.svg by scripts/make-icons.mjs.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      injectManifest: {
        // The app's code and the shell data every visitor needs offline; faction data is cached as it is used (sw.ts).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', 'data/{index,rules,lessons,missions,core-stratagems}.json'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
