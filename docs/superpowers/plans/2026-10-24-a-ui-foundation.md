# Plan A: Design system and app frame

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole app takes on the approved mockups' look:
- condensed display type, a dark ground, a brass accent and red for the one primary action;
- SVG icons;
- Learn · Lists · Practice · Table · Rules tabs;
- an account menu.

Every later plan gets the shared building blocks it needs: a page header with Back, sheets, ⋯ menus, undo toasts, ⓘ info buttons, faction badges, relative times, and a phone-first datasheet.

**Architecture:**
- **New components:** everything new lives in `apps/web/src/ui/`, small and presentational, each with its own test.
- **CSS:** stays in `theme.css` under the existing tokens. Token values change, so every page restyles at once, and the global classes (`.btn`, `.chip`, `.card`, `.row`, `.seg`, `.tabs`, `.status`) are restyled to the mockups.
- **Icons:** Lucide icons enter through a single `ui/icons.ts`.
- **Fonts:** self-hosted with `@fontsource`, imported once in `main.tsx`, so they are precached and work offline.
- **Datasheet page:** the faction datasheet page is the first consumer of `DatasheetView` and `PageHeader`.
- **No other pages change** in this plan beyond what the global styles do. Plans B, C, E1, E2 and E3 adopt the components in wave 2.

**Tech Stack:** unchanged (React 19, React Router 6, Vite 8, Vitest 5, Testing Library, Playwright 1.64). New dependencies in `apps/web`:
- `lucide-react` (ISC licence);
- `@fontsource/barlow-condensed` (OFL: weights 500, 600, 700, latin subset);
- `@fontsource-variable/inter` (OFL, latin subset).

**Spec:** `docs/superpowers/specs/2026-10-24-ui-overhaul-design.md`: §2 (look, tokens, navigation, footer, 404), §3 (every component and signature), §5 (file ownership) and §6 (rules). The mockups are the "Recruit+ redesign mockups" canvas; its artboard sources are in this session's scratchpad `redesign/project/*.dc.html`. Copy spacing, sizes and colours from them.

**Branch:** `ui-foundation` in worktree `L:\9th Edition\app-ui`, off `main` after `auth-passwords` is merged in. Runs alongside Plan D, which touches only `packages/data`, `apps/web/src/data/` and `apps/web/src/sw.ts`.

## Global Constraints

- **Tokens:** exactly the §2 table: `--bg #121110`, `--surface #1b1a18`, `--surface-2 #24221f`, `--border #2c2925`, `--border-strong #4a4135`, `--input-border #7a7064`, `--text #ede7dd`, `--text-soft #b9b0a3`, `--text-muted #a69d90`, `--brass #b08d57`, `--brass-strong #d1ab6c`, `--red #a3262b`, `--red-strong #c1373c`, `--danger-text #f08a8d`, `--ok #8fd19c`, `--ok-bg #1d2a1f`, `--warn #f0b45a`, `--font-display`, `--font-body`.
- **Contrast:** text pairs reach at least 4.5:1, and focus rings and control borders at least 3:1 (`theme.contrast.test.ts`). `--red-strong` is never a text colour.
- **Sizes:** every interactive element is at least 44×44 CSS px. Icon-only buttons carry an `aria-label`.
- **Phone width:** no horizontal page scroll at 320px or 375px.
- **No emoji** anywhere in UI strings.
- **Disclaimer:** the exact `DISCLAIMER` text stays on every page.
- **Imports:** `lucide-react` is imported only by `ui/icons.ts`.
- **Budgets:** `npm run budgets -w @recruit/web` stays green: entry at most 110 kB gzip, CSS at most 25 kB gzip, precache at most 2.6 MB.
- **Names:** the components' names and signatures are exactly spec §3. Later plans code against them.

## Review Focus

1. **A sheet or menu opened by keyboard:** focus moves into it, Esc closes it and focus returns to the button that opened it. Pinned in the Sheet and Menu tests (Tasks 4, 5).
2. **A long title or a long list name in `PageHeader` at 320px:** it truncates with an ellipsis, and Back and the actions stay on screen. Pinned in the PageHeader test (Task 3) and the e2e width check (Task 10).
3. **Two toasts in quick succession**, for example deleting two lists: the second replaces the first, and the first's Undo can't fire after it is gone. Pinned in Task 6.
4. **A datasheet with no weapons, or a unit whose `models[0]` lacks a stat:** `keyStats` returns `'-'` for the missing value, never `undefined` on screen. Pinned in Task 9.
5. **Signed-out pages:** the account button is absent, and the footer and 404 still render. Pinned in Task 8.

---

### Task 1: Tokens, fonts, type scale and buttons

**Files:**
- Modify: `apps/web/package.json` (dependencies), `apps/web/src/main.tsx`, `apps/web/src/theme.css`
- Test: `apps/web/src/theme.contrast.test.ts`, `apps/web/src/theme.test.ts` (new)

**Interfaces:**
- Produces:
  - CSS tokens per Global Constraints.
  - Button classes `.btn` (secondary: `--border-strong` outline), `.btn--primary` (`--red` fill, white text), `.btn--tertiary` (text only, `--brass-strong`), `.btn--danger` (`--danger-text` text, `--red-strong` outline), `.btn--icon` (44×44, no padding).
  - The headings `h1`/`h2`/`h3` use `--font-display`.
  - `.label-caps`: the display font, 600, uppercase, letter-spacing 0.08em, `--brass-strong`.

- [ ] **Step 1: Write the failing tests**

```ts
// theme.contrast.test.ts — add to the text pairs
for (const fg of ['text', 'text-soft', 'text-muted', 'brass-strong', 'danger-text', 'ok', 'warn'])
  for (const bg of ['bg', 'surface', 'surface-2']) text.push([`--${fg} on --${bg}`, () => token(fg), () => token(bg)]);
text.push(['#ffffff on --red', () => '#ffffff', () => token('red')]);
// and: test('auth errors are not red-strong text', () => expect(rule('.auth-form__error', 'color')).toBe(token('danger-text')));

// theme.test.ts
test('fonts are the display and body faces', () => {
  expect(css).toMatch(/--font-display:\s*'Barlow Condensed'/);
  expect(css).toMatch(/--font-body:\s*Inter/);
  expect(css).toMatch(/:root\s*\{[^}]*font-family:\s*var\(--font-body\)/);
});
test('button variants exist', () => {
  for (const cls of ['.btn--primary', '.btn--tertiary', '.btn--danger', '.btn--icon']) expect(css).toContain(`${cls} {`);
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npm test -w @recruit/web -- theme`
Expected: FAIL. `--text-soft isn't a hex colour in :root`, and there is no `--font-display`.

- [ ] **Step 3: Implement**
  - Install: `npm i -w @recruit/web lucide-react @fontsource/barlow-condensed @fontsource-variable/inter`.
  - In `main.tsx`, import `@fontsource/barlow-condensed/latin-500.css`, `latin-600.css` and `latin-700.css`, plus `@fontsource-variable/inter/wght.css`, before `./theme.css`.
  - Set the `:root` tokens to the spec values.
  - Write the button variants and heading faces.
  - Make `.auth-form__error` use `--danger-text`.
  - Make disabled buttons use `opacity: 0.45` on their own colours (no muddy maroon).

- [ ] **Step 4: Run the tests and check they pass**

Run: `npm test -w @recruit/web -- theme`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/main.tsx apps/web/src/theme.css apps/web/src/theme.contrast.test.ts apps/web/src/theme.test.ts
git commit -m "feat(ui): mockup tokens, Barlow Condensed and Inter, button variants"
```

### Task 2: Icons and the tab bar

**Files:**
- Create: `apps/web/src/ui/icons.ts`
- Modify: `apps/web/src/layout/NavBar.tsx`, `apps/web/src/theme.css` (`.nav*`)
- Test: `apps/web/src/layout/NavBar.test.tsx`

**Interfaces:**
- Produces: `ui/icons.ts`, exactly as spec §3 (if a Lucide name differs in the installed version, alias the nearest icon under the same app name).
- Produces: `NAV_ITEMS: readonly { to: string; label: string; Icon: LucideIcon }[]`.

- [ ] **Step 1: Write the failing test.** Update `NavBar.test.tsx`:

```ts
expect(links.map((l) => l.querySelector('.nav__label')?.textContent)).toEqual(['Learn', 'Lists', 'Practice', 'Table', 'Rules']);
expect(links.map((l) => l.getAttribute('href'))).toEqual(['/learn', '/build', '/play', '/table', '/rules']);
expect(screen.getByRole('link', { name: 'Lists' })).toHaveAttribute('aria-current', 'page');
expect(document.querySelectorAll('.nav__icon svg')).toHaveLength(5);
expect(document.querySelector('.nav')!.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
```

- [ ] **Step 2: Run the test and check it fails.** Run: `npm test -w @recruit/web -- NavBar`. Expected: FAIL on the labels.
- [ ] **Step 3: Implement.**
  - `ui/icons.ts` exports every name in spec §3, `IconLog` (`ScrollText`) included.
  - `NAV_ITEMS` uses `IconLearn`, `IconLists`, `IconPractice`, `IconTable` and `IconRules` at size 22, with `aria-hidden`.
  - The active tab gets `--brass-strong` and an inset 2px top bar (on the rail, a left bar), as in the Lists artboard.
- [ ] **Step 4: Run the test and check it passes.**
- [ ] **Step 5: Commit** with `feat(ui): SVG tab icons; Build and Play read Lists and Practice`.

### Task 3: PageHeader

**Files:**
- Create: `apps/web/src/ui/PageHeader.tsx`, `apps/web/src/ui/PageHeader.test.tsx`
- Modify: `apps/web/src/theme.css` (`.page-head*`; `.topbar` stops being sticky; `.editor-head` and `.editor__aside` `top` offsets drop the top-bar allowance)

**Interfaces:**
- Produces: `PageHeader(props: PageHeaderProps)` exactly per spec §3.
  - `<header class="page-head page-head--sub|top">` holds a Back `<Link>` (44×44, `IconBack`, `aria-label={`Back to ${back.label}`}`), then a title block (`<h1>` and an optional subtitle `<p class="page-head__sub">`), then `<div class="page-head__actions">`.
  - **Sticky:** `position: sticky; top: 0; z-index: 6`.
  - **`sub`:** the h1 is 23px display, single line with an ellipsis.
  - **`top`:** the h1 is 32px with no Back.

- [ ] **Step 1: Write the failing tests**

```tsx
test('a sub-page header has Back to its parent, the title as h1 and its actions', () => {
  render(<MemoryRouter><PageHeader title="Novokh Incursion" subtitle="Necrons · Incursion" back={{ to: '/build', label: 'Your lists' }} actions={<button>Play</button>} /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Back to Your lists' })).toHaveAttribute('href', '/build');
  expect(screen.getByRole('heading', { level: 1, name: 'Novokh Incursion' })).toBeInTheDocument();
  expect(screen.getByText('Necrons · Incursion')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
});
test('a top-level header has no Back', () => {
  render(<MemoryRouter><PageHeader variant="top" title="Your lists" /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: /^Back to/ })).toBeNull();
  expect(screen.getByRole('banner', { hidden: true }) ?? document.querySelector('.page-head--top')).toBeTruthy();
});
test('long titles are clipped, not wrapped', () => {
  render(<MemoryRouter><PageHeader title={'x'.repeat(200)} back={{ to: '/', label: 'Home' }} /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1 })).toHaveClass('page-head__title');
}); // .page-head__title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis } is checked at 320px in Task 10
```

- [ ] **Step 2: Run them and check they fail** (module not found).
- [ ] **Step 3: Implement** `ui/PageHeader.tsx` and its CSS, matching the Main artboard header (padding 6px 10px 6px 4px, `--surface` ground, 1px `--border` bottom).
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(ui): PageHeader with Back, title and actions; the top bar no longer sticks`.

### Task 4: Sheet

**Files:**
- Create: `apps/web/src/ui/Sheet.tsx`, `apps/web/src/ui/Sheet.test.tsx`
- Modify: `apps/web/src/theme.css` (`.sheet*`, `.sheet-backdrop`)

**Interfaces:**
- Produces: `Sheet(props: SheetProps)` exactly per spec §3. On phones:
  - `kind='sheet'` is a bottom sheet (max-height 85vh, 18px top radius, a grab handle drawn by CSS);
  - `kind='full'` is full screen.

  At 768px and up, both kinds are a 480px right-hand drawer over a backdrop. `inline` is a static column with no backdrop and no close button.
- **Header:** `<h2 tabIndex={-1}>`, which receives focus on open, plus an icon close button (`IconClose`, `aria-label={closeLabel}`).
- **Footer:** `footer` renders in `<div class="sheet__footer">`, pinned to the bottom.
- **Closing:** the backdrop `<button class="sheet-backdrop" aria-label={closeLabel} tabIndex={-1}>` closes on click. Esc closes. On unmount, focus returns to `document.activeElement` as it was when the sheet opened.

- [ ] **Step 1: Write the failing tests:**
  - `focuses its heading when opened`
  - `Escape calls onClose`
  - `the backdrop calls onClose`
  - `focus goes back to the opener when it closes`: render a button that toggles the Sheet, click it, press Escape, and expect the button to have focus
  - `footer is rendered after the content`
  - `inline has no close button and is not a dialog`: `queryByRole('dialog')` is null and `getByRole('region', { name: title })` is present
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
  - `role="dialog"`, `aria-modal="true"` and `aria-labelledby` the heading id (`useId`).
  - One Esc listener at a time, the latest sheet's, so nested sheets close one by one: keep a module-level stack.
  - Stacking (spec §3): `.sheet` z-index 40, `.sheet-backdrop` 39. Plan E3's full-screen game sits at 20.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(ui): Sheet — bottom sheet, full screen or side drawer`.

### Task 5: Menu

**Files:**
- Create: `apps/web/src/ui/Menu.tsx`, `apps/web/src/ui/Menu.test.tsx`
- Modify: `apps/web/src/theme.css` (`.menu*`)

**Interfaces:**
- Produces: `MenuItem` and `Menu(props)` exactly per spec §3.
  - **Trigger:** a `<button aria-haspopup="menu" aria-expanded>`, by default `.btn--icon` with `IconMore` and `aria-label={label}`.
  - **Popup:** `<div role="menu" aria-label={label}>`, positioned under the trigger and aligned right, kept inside the viewport.
  - **Items:** a `<button role="menuitem">`, or `<Link role="menuitem" to>` when `to` is set. `danger` adds `.menu__item--danger` (`--danger-text`). A divider is drawn before the first danger item.

- [ ] **Step 1: Write the failing tests:**
  - `opens on click and lists the items as menuitems`
  - `ArrowDown/ArrowUp move focus, Home/End jump`
  - `Escape closes and returns focus to the trigger`
  - `a click outside closes`
  - `selecting an item calls onSelect and closes`
  - `an item with to is a link`: `getByRole('menuitem', { name: 'Play' })` has `href` `/build/1/play`
  - `danger items are marked`
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** Focus the first item on open. A `pointerdown` listener on `document` handles outside clicks. The menu's z-index is 45; the toast region (Task 6) is 50.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(ui): accessible ⋯ menu`.

### Task 6: Toasts with Undo

**Files:**
- Create: `apps/web/src/ui/toast.tsx`, `apps/web/src/ui/toast.test.tsx`
- Modify: `apps/web/src/App.tsx` (wrap the router content in `<ToastProvider>`), `apps/web/src/theme.css` (`.toast*`)

**Interfaces:**
- Produces: `ToastInput`, `ToastProvider` and `useToast()` exactly per spec §3.
  - **Count:** one toast at a time; a new one replaces the current one.
  - **Placement:** `<div role="status" aria-live="polite" class="toast-region">`, fixed above the tab bar (`bottom: calc(var(--nav-h) + 12px + safe-area)`); at 768px and up, bottom-centre.
  - **Action:** the action button reads `action.label`, calls `onAction` once and dismisses.
  - **Closing:** a close icon button reads "Dismiss".
  - **Calling it with no provider:** `useToast()` throws `useToast needs a ToastProvider`.

- [ ] **Step 1: Write the failing tests** (fake timers):

```tsx
test('shows the message and Undo, and Undo runs once', async () => { /* show({message:'Deleted “Novokh Incursion”', action:{label:'Undo', onAction}}); click Undo; expect(onAction).toHaveBeenCalledTimes(1); expect(queryByText(/Deleted/)).toBeNull(); */ });
test('disappears after 6 seconds by default', () => { /* advance 5999 → visible; advance 1 → gone */ });
test('a second toast replaces the first; the first Undo is gone', () => { /* show A, show B: getAllByRole('button',{name:'Undo'}) has length 1 and clicking it calls B's handler */ });
test('useToast outside a provider throws', () => { /* expect(() => renderHook(useToast)).toThrow('useToast needs a ToastProvider') */ });
```

- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** Each show gets a fresh id. The timer is cleared on replace and on unmount.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(ui): toasts with an Undo action`.

### Task 7: InfoButton, FactionBadge and relativeTime

**Files:**
- Create: `apps/web/src/ui/InfoButton.tsx`, `apps/web/src/ui/FactionBadge.tsx`, `apps/web/src/ui/relativeTime.ts`, and a test file for each
- Modify: `apps/web/src/theme.css` (`.faction-badge*`)

**Interfaces:**
- Produces per spec §3.
- **`FactionBadge` root:** `<span class="faction-badge faction-badge--{size}" aria-hidden="true">`. Plans B, E1 and E2 find it by `.faction-badge`.
- **`factionTint(slug)`** is internal. Tints by faction group use the Lists artboard pairs (bg/fg):
  - Necrons and other Xenos `#1f3328`/`#8fd19c`;
  - Imperium `#1d2a40`/`#9cc2f0`;
  - Chaos `#3a1d22`/`#f0a0a6`;
  - Orks `#33301a`/`#dccb6a`.

  Group is looked up from the slug with a small map. Unknown slugs fall back to `--surface-2`/`--text`.

- [ ] **Step 1: Write the failing tests**

```ts
// relativeTime.test.ts — now = Date.UTC(2026, 9, 24, 12)
expect(relativeTime(now - 20_000, now)).toBe('just now');
expect(relativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
expect(relativeTime(now - 60 * 60_000, now)).toBe('1 hour ago');
expect(relativeTime(now - 2 * 3600_000, now)).toBe('2 hours ago');
expect(relativeTime(now - 30 * 3600_000, now)).toBe('yesterday');
expect(relativeTime(now - 3 * 86400_000, now)).toBe('3 days ago');
expect(relativeTime(now - 15 * 86400_000, now)).toBe('2 weeks ago');
expect(relativeTime(Date.UTC(2026, 2, 12), now)).toBe('12 Mar 2026');
// FactionBadge.test.tsx
expect(factionInitials('Necrons')).toBe('NEC'); expect(factionInitials('Space Marines')).toBe('SM');
expect(factionInitials('Orks')).toBe('ORK'); expect(factionInitials("T'au Empire")).toBe('TE');
// the badge is aria-hidden and shows the initials
// InfoButton.test.tsx: the button is named by label; clicking opens a dialog titled `title` containing children; Close returns focus.
```

- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.**
  - `factionInitials`: one word gives its first three letters in upper case; several words give the first letter of each of the first two significant words, ignoring "of" and "the".
  - `relativeTime` uses `en-GB` date formatting beyond 30 days.
- [ ] **Step 4: Run them and check they pass.**
- [ ] **Step 5: Commit** with `feat(ui): info button, faction badge, relative time`.

### Task 8: Account menu, footer rule and Page not found

**Files:**
- Create: `apps/web/src/pages/NotFound.tsx`, `apps/web/src/pages/NotFound.test.tsx`
- Modify:
  - `apps/web/src/App.tsx` (`AccountMenu`)
  - `apps/web/src/layout/AppShell.tsx`, `apps/web/src/layout/Footer.tsx`
  - `apps/web/src/routes.tsx` (`path="*"` → `<NotFound />`)
  - `apps/web/src/layout/AppShell.test.tsx`
  - `apps/web/e2e/builder.spec.ts:126-127`, `apps/web/e2e/share.spec.ts:69`, `apps/web/e2e/smoke.spec.ts:31` (Sign out is now inside the account menu)

**Interfaces:**
- **`AccountMenu`:** `<Menu label="Account" trigger={<IconAccount/>}>`, whose first item is a non-interactive header showing the email (`aria-hidden={false}`, `role="presentation"`), then `{ label: 'Sign out', onSelect: signOut }`.
- **`Footer`:** `Footer({ full }: { full: boolean })`.
  - `full` renders today's three paragraphs.
  - Compact renders `<p class="footer__compact">{DISCLAIMER} <Link to="/legal">Legal & credits</Link></p>`.
- **When the footer is full:** `AppShell` decides with `FULL_FOOTER_PATHS = ['/', '/legal', '/privacy', '/terms', '/sign-in', '/reset-password']`.
- **`NotFound`:** `PageHeader variant="top" title="Page not found"`, the text `That page doesn’t exist. It may have moved, or the link is wrong.`, and links `Go home` (`/`) and `Your lists` (`/build`).

- [ ] **Step 1: Write the failing tests:**
  - `AppShell` on `/` shows "Data from the BSData community project" (full).
  - `AppShell` on `/build` shows the `DISCLAIMER` but not the BSData credit (compact).
  - Signed out, there is no Account button.
  - Signed in, Account opens a menu with the email and Sign out, and choosing Sign out calls `signOut`.
  - `NotFound` renders through `AppRoutes` at `/no-such-page`: the heading is "Page not found" and the URL stays (no redirect).
- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement.** In the three e2e specs, replace `getByRole('button', { name: 'Sign out' })`:
  - in `builder.spec.ts`, open `getByRole('button', { name: 'Account' })` and then click `getByRole('menuitem', { name: 'Sign out' })`;
  - in `share.spec.ts`, check the Account button is absent;
  - in `smoke.spec.ts`, check the Account button's size instead.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- AppShell NotFound` and `CI=true npx playwright test -c apps/web/playwright.config.ts builder share smoke`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(ui): account menu, compact footer, Page not found`.

### Task 9: The phone-first datasheet

**Files:**
- Create:
  - `apps/web/src/ui/datasheet/DatasheetView.tsx`, `StatGrid.tsx`, `WeaponCard.tsx`, `format.ts`, `index.ts`
  - Tests: `format.test.ts`, `DatasheetView.test.tsx`
- Modify:
  - `apps/web/src/factions/DatasheetPage.tsx` (PageHeader with `back={{ to: `/factions/${slug}`, label: factionDisplayName(catalogue.name) }}`, then `<DatasheetView unit headingLevel={2} />`)
  - `apps/web/src/factions/DatasheetPage.test.tsx`
  - `apps/web/e2e/smoke.spec.ts:15-18` (reads the stat grid, not a table)
  - `apps/web/src/theme.css` (`.stat-grid*`, `.weapon-card*`, `.ability*`)

**Interfaces:**
- Produces the datasheet exports exactly per spec §3.
- **`weaponLine`:**
  - ranged: `${Range} · ${Type} · S${S} · AP ${AP} · D${D}`;
  - melee (Range or Type `Melee`): `Melee · S ${S} · AP ${AP} · D${D}`;
  - an AP of `0` shows as `AP 0`.
- **`keyStats`:** reads `unit.models[0].chars` (`Save` → `Sv`), and `inv` from the first ability whose plain or text matches `/(\d)\+ invulnerable save/i`. A missing stat is `'-'`.
- **`sizeLabel`:** `null` when `minModels` is null.
- **`StatGrid`:** a `<dl>` of 9 boxes (`<dt>` label, `<dd>` value), 5 columns: M WS BS S T, then W A Ld Sv.
- **`WeaponCard`:** an `<article>` with the name (and `×count`), a 5-cell `<dl>` (RANGE, TYPE, S, AP, D) and the abilities text, plain or official per `useWording()`.
- **`DatasheetView` layout:**
  - **Header:** `<h1|h2>` name plus Legends and FW badges, a meta line (`role · sizeLabel · N pts · N PL`, no base size when it is `Use model`), the amended note, then `WordingToggle`.
  - **Stats:** `StatGrid` per model profile. A degrading profile ("Doomsday Ark [1] (8+ Wounds Remaining)") becomes a "Wound track" block whose rows are labelled `8+ wounds left`, `4–7 wounds left` and so on.
  - **Weapons:** taken weapons first (when `taken` is given), then the rest. Weapons and abilities with `extra: true`, and with `taken` given any weapon not taken, go under `<details><summary>Other wargear options</summary>`.
  - **Abilities:** title plus `RulesText`.
  - **Keywords.**
  - **No `ReportButton`:** `DatasheetView` renders none. `DatasheetPage` places one, `ReportButton target={{ kind: 'datasheet', name }}`, after the view; Plan E1 reworks reporting per page in wave 2.
  - **`hideName`:** omits the name heading inside sheets already titled with the unit's name. The badges and meta line stay.

- [ ] **Step 1: Write the failing tests**

```ts
// format.test.ts (Necron fixtures from factions/__fixtures__/necrons.ts)
expect(weaponLine({ chars: { Range: '24"', Type: 'Rapid Fire 1', S: '4', AP: '-1', D: '1' } })).toBe('24" · Rapid Fire 1 · S4 · AP -1 · D1');
expect(weaponLine({ chars: { Range: 'Melee', Type: 'Melee', S: 'User', AP: '-3', D: '2' } })).toBe('Melee · S User · AP -3 · D2');
expect(keyStats(necronWarriors)).toEqual({ M: '5"', T: '4', Sv: '4+', W: '1', inv: null });
expect(keyStats({ ...necronWarriors, abilities: [{ name: 'Phase Shifter', text: 'This model has a 4+ invulnerable save.', source: 'bsdata' }] }).inv).toBe('4+');
expect(keyStats({ ...necronWarriors, models: [] })).toEqual({ M: '-', T: '-', Sv: '-', W: '-', inv: null });
expect(sizeLabel({ ...necronWarriors, minModels: 1, maxModels: 1 })).toBe('1 model');
expect(sizeLabel(necronWarriors)).toBe('10–20 models');
// DatasheetView.test.tsx
// - the stat grid shows T = 4 for Necron Warriors (getByText within the 'T' box)
// - no element is wider than its container: the page has no <table class="stats">
// - taken=['Gauss Flayer'] puts Gauss Reaper inside the "Other wargear options" details (closed)
// - a weapon with extra: true is inside "Other wargear options" when taken is not given
// - Base: Use model is not shown; "1 models" never appears for a 1-model unit
// - hideName: no heading with the unit's name; the meta line ('Troops · 10–20 models · 110 pts') is still shown
// - the view renders no "Report" button; DatasheetPage shows exactly one
```

Update `DatasheetPage.test.tsx`'s first test:
- the stat check becomes `within(screen.getByRole('group', { name: 'Necron Warrior characteristics' })).getByText('4+')`, where the `<dl>` has `role="group"` and `aria-label={`${profile.name} characteristics`}`;
- the `Back to Necrons` link exists.

The wording tests stay as they are.

- [ ] **Step 2: Run them and check they fail.**
- [ ] **Step 3: Implement**, matching the PlayDatasheet artboard. `TableScroll` stays for other users; the datasheet no longer uses it.
- [ ] **Step 4: Run** `npm test -w @recruit/web -- datasheet DatasheetPage` and `CI=true npx playwright test -c apps/web/playwright.config.ts smoke`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(ui): phone-first datasheet — stat grid, weapon cards, wound track`.

### Task 10: Restyle the global classes, and verify the look across the app

**Files:**
- Modify: `apps/web/src/theme.css` (`.card`, `.row`, `.chip` plus a new `.chip-row` for single-line scrolling, `.seg`, `.tabs`, `.status` plus a new `.status--warn`, `.list__link`, `.choice`, `.radio-card`, `.panel*`, which keeps working until Plan B removes it)
- Create: `apps/web/e2e/ui-frame.spec.ts`

**Interfaces:**
- Produces:
  - `.chip-row`: `display: flex; gap: 8px; overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none`;
  - `.status--warn`: `--warn` text on `--surface-2`.

- [ ] **Step 1: Write the failing e2e test.** In `ui-frame.spec.ts`, at 320×700 and 375×812:
  - visit `/`, `/build`, `/learn`, `/rules`, `/table`, `/play`, `/factions/necrons/units/necron-warriors` and `/no-such-page`;
  - for each, assert `document.documentElement.scrollWidth <= innerWidth`;
  - assert the computed `font-family` of `h1` starts with `"Barlow Condensed"`;
  - assert no emoji in `document.body.innerText`;
  - on the datasheet, assert the Back link and its 44px height.
- [ ] **Step 2: Run it and check it fails** (at least the emoji and font checks fail before this task's CSS).
- [ ] **Step 3: Implement.**
  - Restyle the classes to the artboards (radius 12px cards, 1px `--border`, row min-height 56px).
  - Run the dev server (`preview_start` in the desktop app, else `npm run dev -w @recruit/web`).
  - Screenshot each tab at 375×812 and at desktop, and fix anything the new tokens break: overlaps, unreadable text, the editor's sticky header offsets.
- [ ] **Step 4: Run** the whole web suite: `npm test -w @recruit/web`, `npm run typecheck`, `npm run build`, `npm run budgets -w @recruit/web`, `CI=true npm run e2e -w @recruit/web`. Expected: all PASS, budgets within limits, axe clean.
- [ ] **Step 5: Commit** with `feat(ui): restyle cards, rows, chips and tabs to the mockups`.

### Task 11: Whole-branch review

- [ ] **Step 1:** Ask for one fresh review of `git diff main...ui-foundation` on the most capable model, against the spec's §2 and §3 and this plan's Review Focus.
- [ ] **Step 2:** Fix the confirmed findings test-first, re-run Task 10 Step 4, and commit.
- [ ] **Step 3:** Report the branch ready to merge (A merges before D). Don't merge or push without the owner's go-ahead.

## Self-review

- **Spec coverage:**
  - §2 look and tokens: Tasks 1 and 10. Nav: Task 2. Top bar and account menu: Tasks 3 and 8. Footer and 404: Task 8.
  - §3 components: icons (Task 2), PageHeader (3), Sheet (4), Menu (5), toast (6), InfoButton, FactionBadge and relativeTime (7), datasheet (9).
  - §4 `extra` flag: honoured by `DatasheetView` (Task 9). Plan D sets it, so A tests it with fixtures.
- **Types:** the names match spec §3. `NAV_ITEMS` gains `Icon` and loses `icon`, and only `NavBar` reads it.
- **Review Focus:** all five are pinned (Tasks 3, 4, 5, 6, 8 and 9).
- **Proportion:** signatures, copy and assertions only. Component bodies are left to the implementer.
