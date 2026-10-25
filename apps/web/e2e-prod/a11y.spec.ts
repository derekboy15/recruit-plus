/**
 * Accessibility on the production build, at phone and desktop sizes: no serious or critical axe violations (WCAG 2.1
 * A and AA) on every main route and the states people reach from them; a skip link; visible focus; no sideways scroll
 * at 320px. The canvas board is left to axe-free tests of its labels (BoardCanvas and BoardSummary unit tests).
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { crowdedGame, necronsListNamed } from './data';
import { expect, test } from './fixtures';
import { seedDoc } from './helpers';
import { tableGame } from './seeds';

async function audit(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('canvas').analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.target.join(' ')} (${v.help})`));
}

interface Ids { listId: string; tableId: string; playId: string }
interface State { name: string; path: (ids: Ids) => string; ready?: (page: Page) => Promise<void>; act?: (page: Page) => Promise<void> }

const heading = (page: Page) => expect(page.locator('h1, h2, [role=application], .scoreboard__pos').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
const click = (name: string | RegExp) => async (page: Page) => page.getByRole('button', { name }).first().click();
const tab = (name: string) => async (page: Page) => page.getByRole('tab', { name }).click();

const STATES: State[] = [
  { name: 'home', path: () => '/' },
  { name: 'legal', path: () => '/legal' },
  { name: 'privacy', path: () => '/privacy' },
  { name: 'terms', path: () => '/terms' },
  { name: 'share', path: (i) => `/share/${i.listId}` },
  { name: 'learn', path: () => '/learn' },
  { name: 'lesson', path: () => '/learn/what-is-40k' },
  { name: 'drill', path: () => '/learn/what-is-40k/drill', ready: async (p) => expect(p.getByRole('region', { name: 'Drill' })).toBeVisible({ timeout: 20_000 }) },
  { name: 'first game locked', path: () => '/learn/first-game' },
  { name: 'lists', path: () => '/build' },
  { name: 'new list', path: () => '/build/new' },
  { name: 'new list: battle size', path: () => '/build/new', act: async (p) => { await click(/^Necrons/)(p); await click('Next')(p); } },
  { name: 'list editor', path: (i) => `/build/${i.listId}`, ready: async (p) => expect(p.getByRole('meter', { name: 'Points' })).toBeVisible({ timeout: 20_000 }) },
  {
    name: 'list editor: add unit and wargear',
    path: (i) => `/build/${i.listId}`,
    act: async (p) => {
      await click(/^Add unit$/)(p);
      await p.getByRole('dialog', { name: 'Add a unit' }).getByRole('searchbox', { name: 'Search units' }).fill('warriors');
      await p.getByRole('dialog', { name: 'Add a unit' }).getByRole('button', { name: 'Add Necron Warriors' }).click();
      await expect(p.getByRole('dialog', { name: 'Necron Warriors' })).toBeVisible();
    },
  },
  {
    name: 'list editor: unit preview',
    path: (i) => `/build/${i.listId}`,
    act: async (p) => {
      await click(/^Add unit$/)(p);
      await p.getByRole('dialog', { name: 'Add a unit' }).getByRole('button', { name: /^Skorpekh Destroyers/ }).click();
      await expect(p.getByRole('dialog', { name: 'Skorpekh Destroyers' })).toBeVisible();
    },
  },
  {
    name: 'list editor: army choice',
    path: (i) => `/build/${i.listId}`,
    act: async (p) => {
      await click(/^Dynasty: /)(p);
      await expect(p.getByRole('dialog', { name: 'Choose: Dynasty' })).toBeVisible();
    },
  },
  { name: 'list editor: problems', path: (i) => `/build/${i.listId}`, act: async (p) => { await click(/to fix$|^All checks pass$/)(p); await expect(p.getByRole('dialog', { name: 'Problems' })).toBeVisible(); } },
  {
    name: 'list editor: export',
    path: (i) => `/build/${i.listId}`,
    act: async (p) => {
      await click('List actions')(p);
      await p.getByRole('menuitem', { name: 'Export' }).click();
      await expect(p.getByRole('dialog', { name: 'Export list' })).toBeVisible();
    },
  },
  {
    name: 'lists: a list’s menu',
    path: () => '/build',
    act: async (p) => {
      await click(/^Actions for /)(p);
      await expect(p.getByRole('menu')).toBeVisible();
    },
  },
  { name: 'rules', path: () => '/rules' },
  { name: 'rules article', path: () => '/rules/basics' },
  { name: 'glossary filtered', path: () => '/rules/glossary', act: async (p) => p.getByRole('searchbox').first().fill('cover') },
  { name: 'core stratagems', path: () => '/rules/stratagems' },
  { name: 'faction guides', path: () => '/rules/factions' },
  { name: 'rules reports', path: () => '/rules/reports' },
  { name: 'report dialog', path: () => '/rules/basics', act: click('Report a rules error') },
  { name: 'factions', path: () => '/factions' },
  { name: 'faction', path: () => '/factions/necrons' },
  { name: 'datasheet', path: () => '/factions/necrons/units/necron-warriors' },
  { name: 'datasheet official', path: () => '/factions/necrons/units/necron-warriors', act: click('Official wording') },
  { name: 'faction guide', path: () => '/factions/necrons/guide' },
  { name: 'faction stratagems', path: () => '/factions/necrons/stratagems' },
  { name: 'games', path: () => '/play' },
  { name: 'new sandbox game', path: () => '/play/new' },
  { name: 'sandbox game', path: (i) => `/play/${i.playId}`, ready: async (p) => expect(p.getByRole('application')).toBeVisible({ timeout: 20_000 }) },
  { name: 'sandbox menu', path: (i) => `/play/${i.playId}`, act: click('Menu') },
  { name: 'sandbox log', path: (i) => `/play/${i.playId}`, act: click('Log') },
  { name: 'sandbox score', path: (i) => `/play/${i.playId}`, act: async (p) => p.locator('.game__army--A').click() },
  { name: 'sandbox toolkit', path: (i) => `/play/${i.playId}`, act: async (p) => { await click('Menu')(p); await click('Toolkit')(p); } },
  {
    name: 'new sandbox game with both armies chosen',
    path: () => '/play/new',
    act: async (p) => {
      for (const player of ['Player 1', 'Player 2']) await p.getByRole('group', { name: player }).getByRole('radio').first().check();
    },
  },
  {
    name: 'new list: detachment and army options',
    path: () => '/build/new',
    act: async (p) => {
      await click(/^Necrons/)(p);
      await click('Next')(p);
      await click(/Strike Force/)(p);
      await click('Next')(p);
      await click(/Arks of Omen Detachment/)(p);
      await click('Next')(p);
      await expect(p.getByRole('radio', { name: 'Szarekhan' })).toBeVisible();
    },
  },
  {
    name: 'drill after answering (wrong, then on to the next stage)',
    path: () => '/learn/datasheets/drill',
    ready: async (p) => expect(p.getByRole('region', { name: 'Drill' })).toBeVisible({ timeout: 20_000 }),
    act: async (p) => {
      // Try each choice of the first question in turn: the wrong ones show feedback, the right one moves on.
      const card = p.getByRole('region', { name: 'Drill' });
      const n = await card.getByRole('radio').count();
      for (let i = 0; i < n && (await card.getByRole('radio').count()) === n; i++) {
        await card.getByRole('radio').nth(i).check();
        await card.getByRole('button', { name: 'Check answer' }).click();
      }
    },
  },
  {
    name: 'new table game: armies, then attacker and defender',
    path: () => '/table/new',
    act: async (p) => {
      await click(/^Incursion/)(p);
      await click('Next')(p);
      await click(/11 Cleanse the Land/)(p);
      await click('Next')(p);
      const yours = p.getByRole('group', { name: 'Your army' });
      await yours.getByRole('radio', { name: 'Just pick a faction' }).check();
      await yours.getByRole('combobox', { name: 'Faction' }).selectOption('necrons');
      const theirs = p.getByRole('group', { name: "Your opponent's army" });
      await theirs.getByRole('radio', { name: 'Just pick a faction' }).check();
      await theirs.getByRole('combobox', { name: 'Faction' }).selectOption('orks');
    },
  },
  { name: 'table home', path: () => '/table' },
  { name: 'new table game', path: () => '/table/new' },
  { name: 'new table game: mission', path: () => '/table/new', act: async (p) => { await click(/^Incursion/)(p); await click('Next')(p); } },
  { name: 'table game: turn', path: (i) => `/table/${i.tableId}` },
  { name: 'table game: score', path: (i) => `/table/${i.tableId}`, act: tab('Score') },
  { name: 'table game: stratagems', path: (i) => `/table/${i.tableId}`, act: tab('Stratagems') },
  { name: 'table game: tools', path: (i) => `/table/${i.tableId}`, act: tab('Tools') },
  { name: 'table game: odds', path: (i) => `/table/${i.tableId}`, act: async (p) => { await tab('Tools')(p); await tab('Attack odds')(p); } },
  { name: 'table game: log', path: (i) => `/table/${i.tableId}`, act: tab('Log') },
];

function seed(remote: Parameters<typeof seedDoc>[0]): Ids {
  const listId = seedDoc(remote, 'list', necronsListNamed('A11y list'), { isPublic: true });
  // Lesson 1 done, so lesson 2's drill is open.
  seedDoc(remote, 'progress', { schema: 1, lessons: { 'what-is-40k': { completedAt: 1, mistakes: 0 } } });
  return { listId, tableId: seedDoc(remote, 'game', tableGame(listId)), playId: seedDoc(remote, 'game', crowdedGame()) };
}

test.describe('axe', () => {
  for (const state of STATES) {
    test(`no serious or critical axe violations: ${state.name}`, async ({ page, remote, signedIn }) => {
      void signedIn;
      const ids = seed(remote);
      await page.goto(state.path(ids));
      await (state.ready ?? heading)(page);
      if (state.act) await state.act(page);
      await page.waitForTimeout(300);
      expect(await audit(page)).toEqual([]);
    });
  }

  test('no serious or critical axe violations: sign-in', async ({ page }) => {
    await page.goto('/sign-in');
    await heading(page);
    expect(await audit(page)).toEqual([]);
  });
});

test('skip link moves focus to main', async ({ page, signedIn }) => {
  void signedIn;
  await page.goto('/build');
  await heading(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('every focusable element shows a focus ring', async ({ page, signedIn }) => {
  void signedIn;
  for (const path of ['/', '/build', '/rules']) {
    await page.goto(path);
    await heading(page);
    const unringed: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
        return { ring, what: `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 30)}"` };
      });
      if (!r) break;
      if (!r.ring) unringed.push(`${path}: ${r.what}`);
    }
    expect(unringed).toEqual([]);
  }
});

// Checked with the platform font and with a wide one: Linux (DejaVu Sans) and many Android fonts set text wider than
// Windows' Segoe UI, so a row that fits here can still push the page sideways on a phone.
for (const font of [null, 'Verdana, "DejaVu Sans", sans-serif']) {
  test(`no horizontal scroll at 320px${font ? ' with a wide font' : ''}`, async ({ page, remote, signedIn }) => {
    void signedIn;
    await page.setViewportSize({ width: 320, height: 640 });
    const ids = seed(remote);
    const wide: string[] = [];
    for (const path of ['/', '/build', `/build/${ids.listId}`, '/rules/glossary', '/factions/necrons/units/necron-warriors', `/table/${ids.tableId}`, `/play/${ids.playId}`]) {
      await page.goto(path);
      if (font) await page.addStyleTag({ content: `*{font-family:${font} !important}` });
      await heading(page);
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 0) wide.push(`${path}: ${over}px`);
    }
    expect(wide).toEqual([]);
  });
}

test('the board shows a focus ring when it has keyboard focus', async ({ page, remote, signedIn }) => {
  void signedIn;
  const { playId } = seed(remote);
  await page.goto(`/play/${playId}`);
  const board = page.getByRole('application', { name: /Battlefield/ });
  await expect(board).toBeVisible({ timeout: 20_000 });
  await board.focus();
  await page.keyboard.press('ArrowUp');
  // The app's own focus ring (3px solid --focus), not the browser's thin default, which is invisible on the dark board.
  const ring = await board.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(ring.style).toBe('solid');
  expect(ring.width).toBeGreaterThanOrEqual(3);
});
