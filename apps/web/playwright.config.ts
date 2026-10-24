import { defineConfig, devices } from '@playwright/test';

/** E2E_PORT lets parallel worktrees run this suite at once without sharing (or reusing) one dev server. */
const PORT = Number(process.env.E2E_PORT ?? 5179);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { VITE_AUTH_MODE: 'dev' },
    timeout: 120_000,
  },
});
