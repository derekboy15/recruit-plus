import { test as base } from '@playwright/test';
import { FakeRemote, SESSION_KEY, sessionJson } from './fake-supabase';

export { expect } from '@playwright/test';

/**
 * `remote`: the fake Supabase documents table, installed on every test's context.
 * `signedIn`: puts a valid session where supabase-js keeps it, unless the test already put one there; a reload keeps it.
 */
export const test = base.extend<{ remote: FakeRemote; signedIn: void }>({
  remote: [
    async ({ context }, use) => {
      const remote = new FakeRemote();
      await remote.install(context);
      await use(remote);
    },
    { auto: true },
  ],
  signedIn: async ({ context }, use) => {
    await context.addInitScript(
      ([key, value]) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      [SESSION_KEY, sessionJson()] as const,
    );
    await use();
  },
});
