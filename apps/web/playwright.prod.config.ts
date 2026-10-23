import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the real production build (`vite build --mode e2e`) served by `vite preview`, with its
 * service worker. Only the env differs from production: Supabase points at a fake host the tests answer
 * (e2e-prod/fake-supabase.ts). The build is always fresh: a stale dist-e2e must never be tested.
 */
const PORT = 5189;

export default defineConfig({
  testDir: './e2e-prod',
  outputDir: 'test-results-prod',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', serviceWorkers: 'allow' },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
