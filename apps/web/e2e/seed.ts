/** Seeding for end-to-end tests: sign in with the dev account and put a saved list on the device, without the builder. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/** The dev account's id (src/auth/devAuth.ts DEV_USER). */
export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

/** A saved list from e2e/data (written by the unit tests that build it, e.g. src/lists/play/e2eFixture.test.ts). */
export const listFixture = (file: string): unknown =>
  JSON.parse(readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), 'data', file), 'utf8'));

/** Signs in with the dev account ("Continue (dev)"): the app reads it from localStorage on its next load. */
export async function signInDev(page: Page): Promise<void> {
  if (!page.url().startsWith('http')) await page.goto('/');
  await page.evaluate(() => localStorage.setItem('recruit.devUser', '1'));
}

/** Signs the dev account out again (and forgets the remembered user), as a visitor who never signed in. */
export async function signOutDev(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('recruit.devUser');
    localStorage.removeItem('recruit.lastUser');
  });
}

/**
 * Puts a saved list into this browser's app database, as if it had been made on this device. Opens /build first (signed
 * in, see signInDev) so the app creates the database, then writes the row with plain IndexedDB.
 */
export async function seedList(page: Page, doc: { id: string; data: unknown; isPublic?: boolean; ownerId?: string }): Promise<void> {
  await page.goto('/build');
  const row = { id: doc.id, kind: 'list', ownerId: doc.ownerId ?? DEV_USER_ID, data: doc.data, isPublic: doc.isPublic ?? false, deleted: false, dirty: false };
  await page.waitForFunction(async () => (await indexedDB.databases()).some((d) => d.name === 'recruitplus'));
  await page.evaluate(
    (r) =>
      new Promise<void>((resolve, reject) => {
        const attempt = (left: number) => {
          const open = indexedDB.open('recruitplus');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            // The app may still be creating its tables: try again shortly.
            if (!db.objectStoreNames.contains('docs')) {
              db.close();
              if (left > 0) setTimeout(() => attempt(left - 1), 100);
              else reject(new Error('The app database has no docs table'));
              return;
            }
            const tx = db.transaction('docs', 'readwrite');
            tx.objectStore('docs').put({ ...r, updatedAt: Date.now() });
            tx.oncomplete = () => (db.close(), resolve());
            tx.onerror = () => reject(tx.error);
          };
        };
        attempt(50);
      }),
    row,
  );
}
