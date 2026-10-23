import { expect, type BrowserContext, type Page } from '@playwright/test';
import { E2E_USER, type FakeRemote } from './fake-supabase';

/** Waits until the service worker has installed (precache done) and controls this page. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

export const goOffline = (context: BrowserContext) => context.setOffline(true);
export const goOnline = (context: BrowserContext) => context.setOffline(false);

/** Puts one document of the e2e user in the remote; returns its id. */
export function seedDoc(remote: FakeRemote, kind: string, data: unknown, opts: { id?: string; isPublic?: boolean } = {}): string {
  const id = opts.id ?? crypto.randomUUID();
  remote.seed([{ id, kind, data, owner_id: E2E_USER.id, is_public: opts.isPublic ?? false }]);
  return id;
}
