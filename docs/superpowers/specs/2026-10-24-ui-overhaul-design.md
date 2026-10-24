# Recruit+ UI and quality-of-life overhaul: design

*Approved direction: the six phone mockups on the "Recruit+ redesign mockups" canvas (https://claude.ai/artifact/7876Z9d5vpJvDy5AQRc98h), 24 October 2026. The audit behind it is `ux-audit/AUDIT.md` in this session's scratchpad; finding codes (L5, N1, R5…) below refer to it. This spec turns both into seven implementation plans that run in two waves.*

## 1. Why

The owner tested the live site and found it hard to use. The worst problems:
- no Back buttons;
- lists can't be deleted;
- you choose sub-factions, wargear, traits and relics blind;
- you can't see a unit before adding it;
- the list editor feels cluttered;
- there is no read-only "play mode" like New Recruit's;
- the look is "plain or amateur" and "cluttered and cramped".

The audit traced most of the 130 findings to five root causes:
1. no page frame;
2. data reaching the screen with no presentation layer;
3. choices with no explanation;
4. one long column for everything;
5. a flat visual system.

**Success means:**
- every screen has a header with a way back, a title and at most one primary action;
- every army-building choice says what it does before you pick it;
- you can preview any unit before adding it;
- a list can be opened read-only in Play mode and every unit's datasheet read on a phone without sideways scrolling;
- lists can be duplicated, renamed and deleted, with undo;
- the app looks like the mockups.

## 2. Decisions

**Look.** This applies the mockups' visual system to the whole app:
- **Ground and accent:** a dark ground, with brass as the single accent.
- **Red:** reserved for the one primary action per screen and for destructive items.
- **Typefaces:** Barlow Condensed (display: headings, numbers, section labels) over Inter (body), both self-hosted through `@fontsource`, so offline works and no Google request is made at runtime.
- **Icons:** Lucide icons replace the emoji.
- **Buttons:** primary, secondary, tertiary and icon variants.
- **Touch targets:** at least 44px everywhere.

**Tokens:** these replace the values in `apps/web/src/theme.css` `:root`. Existing token names are kept where they exist, so untouched pages restyle for free.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#121110` | page ground |
| `--surface` | `#1b1a18` | cards, rows, sheets |
| `--surface-2` | `#24221f` | raised or selected surfaces, stat boxes |
| `--border` | `#2c2925` | dividers |
| `--border-strong` | `#4a4135` | chips, secondary buttons, selected outlines (new) |
| `--input-border` | `#7a7064` | form controls (unchanged, 3:1) |
| `--text` | `#ede7dd` | body text |
| `--text-soft` | `#b9b0a3` | secondary prose: rule summaries (new) |
| `--text-muted` | `#a69d90` | labels, metadata |
| `--brass` | `#b08d57` | quiet accents, borders |
| `--brass-strong` | `#d1ab6c` | accent text, icons, active tab |
| `--red` | `#a3262b` | primary button fill (white text) |
| `--red-strong` | `#c1373c` | borders only, never text |
| `--danger-text` | `#f08a8d` | destructive menu items, error text (new) |
| `--ok` / `--ok-bg` | `#8fd19c` / `#1d2a1f` | legal, ready |
| `--warn` | `#f0b45a` | "n to fix" (new) |
| `--font-display` | `'Barlow Condensed', system-ui, sans-serif` | (new) |
| `--font-body` | `Inter, system-ui, sans-serif` | (new) |

`theme.contrast.test.ts` gains pairs for each new text token on `--bg`, `--surface` and `--surface-2`. White on `--red` must also pass. `.auth-form__error` stops using `--red-strong` as a text colour (it fails 4.5:1); it uses `--danger-text`.

**Navigation:**
- The bottom tabs (and the desktop rail) become **Learn · Lists · Practice · Table · Rules**, with Lucide icons. Routes don't change (`/learn`, `/build`, `/play`, `/table`, `/rules`). "Play" becomes "Practice" so it no longer clashes with a list's Play mode.
- **Sub-pages:** every page below a tab shows a `PageHeader` with Back to an explicit parent route, never browser history. Top-level pages show a large title and no Back.
- **Top bar:**
  - the top bar is no longer sticky; the page header is;
  - the email and Sign out button become one account icon button that opens a menu (the email as its header, then Sign out).
- **Footer:**
  - the non-affiliation disclaimer stays on every page (the launch spec requires it, and `e2e-prod/legal.spec.ts` checks it);
  - the full footer (disclaimer, data credits, links) shows only on Home, Legal, Privacy, Terms and Sign-in;
  - every other page shows a compact footer: the disclaimer in one small muted paragraph plus a "Legal & credits" link (V8, softened).
- **Unknown URLs:** these get a "Page not found" page with links home, not a silent redirect (N8).

**Sign-in stays required** for everything except Home, the legal pages and share links (the owner's earlier decision, unchanged).

**Undo, not confirm.** Deleting a list or a game, and removing or duplicating a unit, happen at once. Each shows a toast for 6 seconds with **Undo**. The list editor also gets an undo/redo history: 50 steps, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y outside text inputs, and buttons in its header. Ending a Table game moves into a ⋯ menu and asks once, because it can't be undone.

**Descriptions everywhere.** Every option the builder offers names what it is and what it does:
- **sub-faction:** one-line effect;
- **Warlord trait:** effect;
- **relic:** effect;
- **wargear:** weapon profile line;
- **stratagem upgrade:** effect.

An ⓘ button opens the full text in a sheet. The text comes from BattleScribe's own profiles and rules, which the data build currently drops (§4, Plan D). Plain English is shown where an authored plain text exists for that exact official text. Otherwise the official wording is shown, labelled "Official wording". Authoring plain English for these texts is Plan F, after Plan D lands.

**Display names, not data names.** The data layer gives every option a display name and a heading. Examples:
- "Warlord Trait (Novokh): Blood-Fuelled Fury" → **Blood-Fuelled Fury** under "Warlord trait · Novokh";
- "Dynasty: \<Custom\>" → **Custom dynasty**;
- "\[LEGENDS\]" → a Legends badge;
- "1 models" → "1 model".

Backticks are stripped from all rules, lesson and glossary content at build time (R5).

## 3. Shared building blocks (Plan A produces; every later plan consumes)

All live in `apps/web/src/ui/` unless noted. The names and signatures below are binding on every plan.

```ts
// ui/icons.ts — Lucide icons under app names (the only place lucide-react is imported from)
export { ChevronLeft as IconBack, MoreHorizontal as IconMore, Play as IconPlay, Plus as IconPlus, Search as IconSearch,
  Info as IconInfo, X as IconClose, Pencil as IconEdit, Copy as IconCopy, Trash2 as IconDelete, Share as IconShare,
  Check as IconCheck, TriangleAlert as IconWarning, Crown as IconWarlord, ChevronDown as IconExpand,
  ChevronRight as IconNext, Undo2 as IconUndo, Redo2 as IconRedo, GraduationCap as IconLearn, ListChecks as IconLists,
  Dices as IconPractice, ClipboardList as IconTable, BookOpen as IconRules, CircleUser as IconAccount,
  ScrollText as IconLog } from 'lucide-react';

// ui/PageHeader.tsx
export interface PageHeaderProps {
  title: ReactNode;                              // rendered in the page's <h1>
  subtitle?: ReactNode;
  back?: { to: string; label: string };          // Back link: aria-label `Back to ${label}`
  actions?: ReactNode;                           // icon buttons, a Menu, at most one primary action
  variant?: 'top' | 'sub';                       // 'top': large title, no Back (default 'sub')
}
export function PageHeader(props: PageHeaderProps): JSX.Element;   // <header class="page-head">, sticky top 0

// ui/Sheet.tsx — replaces lists/Panel.tsx (Plan B moves the builder onto it)
export interface SheetProps {
  title: string;
  onClose: () => void;
  kind?: 'sheet' | 'full';     // phone: bottom sheet (max 85vh) or full screen. ≥768px: 480px right-hand drawer.
  inline?: boolean;            // ≥768px only: a resting side column (no backdrop, no close button)
  closeLabel?: string;         // default 'Close' (icon button with this aria-label)
  footer?: ReactNode;          // pinned to the bottom of the sheet (primary action)
  children: ReactNode;
}
export function Sheet(props: SheetProps): JSX.Element;  // role=dialog named by its title (aria-labelledby), focuses its heading,
// Esc and backdrop close, returns focus to the opener. Stacking: sheet 40, its backdrop 39, menu 45, toast 50 (above the
// full-screen game at 20).

// ui/Menu.tsx — the ⋯ menu
export interface MenuItem { label: string; icon?: ReactNode; onSelect?: () => void; to?: string; danger?: boolean }
export function Menu(props: { label: string; items: MenuItem[]; trigger?: ReactNode }): JSX.Element;
// trigger defaults to a 44px icon button with IconMore and aria-label={label}; role=menu, arrow keys, Esc, outside click

// ui/toast.tsx
export interface ToastInput { message: string; action?: { label: string; onAction: () => void }; durationMs?: number } // default 6000
export function ToastProvider(props: { children: ReactNode }): JSX.Element;   // mounted in App.tsx
export function useToast(): { show(t: ToastInput): void };                     // role=status, aria-live=polite, above the tab bar

// ui/InfoButton.tsx — the ⓘ pattern
export function InfoButton(props: { label: string; title: string; children: ReactNode }): JSX.Element;
// a 44px icon button (IconInfo, aria-label={label}) that opens <Sheet kind="sheet" title={title}>{children}</Sheet>

// ui/FactionBadge.tsx
export function FactionBadge(props: { slug: string; name: string; size?: 'sm' | 'md' }): JSX.Element; // <span class="faction-badge">, initials + tint, aria-hidden
export function factionInitials(name: string): string;     // "Necrons" → "NEC", "Space Marines" → "SM", "Orks" → "ORK"

// ui/relativeTime.ts
export function relativeTime(at: number, now?: number): string;
// "just now" (<1 min), "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", "2 weeks ago", else "12 Mar 2026"

// ui/datasheet/ — the phone-first datasheet (R1, R2, R4)
export function DatasheetView(props: {
  unit: UnitOut;
  taken?: string[];            // weapon names this unit has: shown first, the rest under a collapsed "Other wargear options"
  headingLevel?: 1 | 2;        // 1 on the datasheet page, 2 inside sheets
  hideName?: boolean;          // inside a Sheet already titled with the unit's name: no repeated name heading
}): JSX.Element;               // renders no ReportButton: the page that shows it places one report button per page (R3)
export function StatGrid(props: { profile: ProfileOut }): JSX.Element;   // two rows: M WS BS S T / W A Ld Sv
export function WeaponCard(props: { weapon: ProfileOut; count?: number }): JSX.Element;
export function weaponLine(p: { chars: Record<string, string> }): string; // `24" · Rapid Fire 1 · S4 · AP -1 · D1`, melee: `Melee · S User · AP -3 · D2`
export function keyStats(unit: UnitOut): { M: string; T: string; Sv: string; W: string; inv: string | null };
export function sizeLabel(unit: UnitOut): string | null;  // "1 model", "5–10 models"
```

The CSS for all of these lives in `theme.css`. Plan A also restyles the existing global classes (`.btn`, `.chip`, `.card`, `.row`, `.seg`, `.tabs`) to the mockups, so pages no plan touches still change.

## 4. Data contracts (Plan D produces)

```ts
// packages/data/src/model/types.ts
export interface InfoProfile { name: string; type: string; chars: Record<string, string>; plain?: Record<string, string> }
export interface InfoRule { name: string; text: string; plain?: string }
export interface EntryInfo { profiles?: InfoProfile[]; rules?: InfoRule[] }
export interface InfoFile { schema: 1; slug: string; entries: Record<string, EntryInfo> }  // keyed by BSData entry id

// ProfileOut and AbilityOut gain one optional flag (R2): set on weapons and abilities that come from relics, chapter or
// Army-of-Renown options rather than the unit's own wargear. DatasheetView lists them under a collapsed "Also available".
//   ProfileOut.extra?: true   AbilityOut.extra?: true

// packages/data/src/roster/names.ts (exported from '@recruit/data/roster')
export interface OptionDisplay { name: string; heading: string | null; legends: boolean }
export function optionDisplay(bsName: string): OptionDisplay;

// packages/data/src/roster/exportText.ts (exported from '@recruit/data/roster') — what a unit holds, in player words
export interface UnitSummary {
  gear: string[];      // "5x Gauss Blaster", "Staff of Light": wargear, counted like the export
  warlord: boolean;
  traits: string[];    // Warlord trait names (optionDisplay names, no prefixes)
  relics: string[];    // relic names
  other: string[];     // any other chosen upgrade (stratagem upgrades, psychic powers…), optionDisplay names
}
export function unitSummary(v: SelView): UnitSummary;  // used by Plan B's list rows and Plan C's Play mode

// apps/web/src/data/entryInfo.ts
export type EntryInfoIndex = Map<string, EntryInfo>;
export function loadEntryInfo(catalogueSlugs: string[]): Promise<EntryInfoIndex>;  // every file in the slugs' rosterScope, plus 'system'
export function entryInfo(scope: Scope, index: EntryInfoIndex | null, entryId: string): EntryInfo | undefined; // link → target id
export function summaryLine(info: EntryInfo, wording: 'plain' | 'official'): string | null; // first sentence of the first rule or ability text
```

- **Build output:** `generated/info/<slug>.json`, one per roster file (catalogues, libraries and `system`). It holds the profiles and rules of every selection entry and group, with infoLinks resolved across the file's scope.
- **Fetching:** files are served at `/data/info/<slug>.json` and cached at runtime by the service worker like catalogues.
- **Size limit:** a new budget line, `infoGzip`, of 150 kB per file.

**Plan C contract, which Plan E2 consumes:**

```ts
// apps/web/src/lists/play/ArmyDrawer.tsx
export function ArmyDrawer(props: { listId: string; onClose: () => void }): JSX.Element;
// a <Sheet kind="full"> titled with the list's name, holding the same read-only army view as Play mode:
// army rules, units by role with key stats, tap a unit → its datasheet. Read-only; for a list the device no longer has,
// it says "This list isn’t on this device any more." and offers nothing else.
```

Plan D also fixes these data bugs, each test-first, after finding the root cause:
- **C1:** faction-page points differ from builder points.
- **C2:** export counts are wrong ("5 models · 1x Warscythe").
- **Royal Warden:** has no weapons.
- **L15, which is mostly not a bug:** under Arks of Omen (Incursion, Strike Force) a Warlord gets a trait only through the 1 CP Warlord Trait Requisition, and a relic only through the Relic Requisition. This is from the library's `01_Core_Rules/Army_Building_Detachments_and_CP.md` §5–6, and `test/fixed-warlord-traits.test.ts` already pins it.
  - **Plan D** checks that Combat Patrol and Onslaught (Core Book rules) offer the Warlord's trait and one relic without a stratagem, and fixes them if not.
  - **Plan B** explains the requisition where the player looks for it. Under a Warlord the editor says: "In Arks of Omen games your Warlord only gets a Warlord trait if you pay 1 CP for it. Tick Warlord trait (1 CP) below to choose one."
- **R5:** backticks show in rules content.

## 5. Plans, waves and file ownership

| Plan | Branch / worktree | Wave | Needs | Scope |
|---|---|---|---|---|
| **A. Design system and app frame** | `ui-foundation` / `L:\9th Edition\app-ui` | 1 | n/a | §2 look, tokens, fonts and icons; nav, account menu, footer rule, 404; every §3 component; the datasheet page adopts `DatasheetView` |
| **D. Data presentation layer** | `data-presentation` / `L:\9th Edition\app-data` | 1 | n/a | §4: entry info, `optionDisplay`, data bug fixes, backticks |
| **B. Army builder** | `builder-overhaul` / `L:\9th Edition\app-builder` | 2 | A, D | lists overview, editor frame, role sections, rows, picker with preview, option descriptions, army-choice sheets, wizard choices, undo/redo, export wrapping |
| **C. Play mode** | `play-mode` / `L:\9th Edition\app-play-mode` | 2 | A, D | `/build/:id/play`, share page as a read-only play view plus "Save to my lists", the `ArmyDrawer` component for the Table |
| **E1. Learn, Rules, Factions, Home** | `content-pages` / `L:\9th Edition\app-content` | 2 | A | signed-in home, open lessons, sticky drill start, rules table of contents, one report button per page, glossary A–Z, faction search and crests, sign-in Google first |
| **E2. Table companion** | `table-polish` / `L:\9th Edition\app-table` | 2 | A, C (last task only) | page frame, End game in a menu, Next phase explained, games list rows, delete with undo, list-aware stratagem filters, secondaries explained, mounts `ArmyDrawer` |
| **E3. Practice (sandbox)** | `practice-polish` / `L:\9th Edition\app-practice` | 2 | A | exit control, phase tracker, dice sorted and tallied, map legend, phone layout with pinned action bar, newest-first log, setup tidy, delete with undo |
| **F. Plain English for choices** | (after D) | 3 | D | authored plain text for the new option texts, parallel by faction group like M3 |

**Who owns which files.** Two plans never edit the same file in the same wave. In wave 2:
- **B** owns `apps/web/src/lists/*`, except `lists/play/` and `SharePage.tsx`. It also owns `e2e/builder.spec.ts`, `e2e/editor.spec.ts` and `e2e/lists.spec.ts`.
- **C** owns `apps/web/src/lists/play/` (new), `lists/SharePage.tsx`, the `/build/:id/play` line in `routes.tsx` and `e2e/share.spec.ts`. It adds `e2e/play-mode.spec.ts`.
- **E1** owns:
  - `apps/web/src/learn/*`, `rules/*`, `factions/*` and `pages/*`;
  - `e2e/learn.spec.ts` and `e2e/rules.spec.ts`;
  - `e2e-prod/sign-in.spec.ts`.
- **E2** owns `apps/web/src/table/*` and `e2e/table.spec.ts`.
- **E3** owns `apps/web/src/play/*` and `e2e/sandbox.spec.ts`. It also fixes the first game's objective labels (LE9), which come from `play/setup/missionAdapter.ts`.
- **The shared production-suite specs** (`e2e-prod/a11y.spec.ts`, `offline.spec.ts` and `harness.spec.ts`) drive the builder. In wave 2 only Plan B edits them, to follow its own label changes. Other plans add any new checks in their own spec files.
- **Builder labels other plans' tests rely on stay unchanged:**
  - wizard: `New list`, `Next`, `Back`, `Decide later`, `Create list`, and the faction rows' names;
  - editor: the `role="meter"` named `Points`.

  Other plans' tests should create lists by seeding, not through the builder screens (C, E2 and E3 do).

`theme.css`, `App.tsx`, `main.tsx`, `layout/*`, `ui/*` and `routes.tsx` belong to Plan A in wave 1. In wave 2 they are frozen, except C's one route line. Wave-2 plans put new CSS in their own stylesheet, imported by their own entry component:
- B: `lists/lists.css`;
- C: `lists/play/play-mode.css`;
- E1: `rules/rules.css` and `pages/pages.css`, plus the existing `learn/learn.css`;
- E2: `table/table.css`;
- E3: `play/play.css`.

**Before wave 1:**
- the `auth-passwords` branch is merged into `main`, locally and with no push (the owner approves this);
- worktrees branch from that `main`.

**After wave 1:** A and D merge into `main` (A first), with the full suite green.

**After wave 2:**
- the five branches merge into `main` in the order B, C, E1, E3, E2;
- E2 last, because its final task mounts C's `ArmyDrawer`;
- the full suite runs after each merge.

Nothing is pushed or deployed without the owner's go-ahead.

## 6. Rules for every plan

- **Execution:** native, test-first, one commit per task. One whole-branch review on the most capable model at the end, before merging.
- **Tests:**
  - Vitest and Testing Library for components;
  - Playwright for flows, at 375×812 and 1280×800;
  - axe stays clean (`e2e-prod/a11y.spec.ts`).
- **Breaking tests:** a plan that changes copy or labels updates the specs that assert them. Within its own wave it may touch only its own specs.
- **Commands per task:** `npm test -w @recruit/web` (or the package's tests) and `npm run typecheck`.
- **Commands per plan, at the end:**
  - `npm run build`;
  - `npm run budgets -w @recruit/web`;
  - `CI=true npm run e2e -w @recruit/web`.
- **Phone width:**
  - no horizontal page scroll at 320px or 375px;
  - every page header, sheet and menu works at 375×812;
  - the e2e suites assert "no horizontal scroll" on the screens each plan changes.
- **Copy:**
  - plain words, sentence case, curly apostrophes (’) in UI strings, as the app already does;
  - no emoji;
  - name things as the player sees them (Lists, Practice, Play mode).
- **No data names on screen:** anything shown from BSData or Wahapedia goes through `optionDisplay`, `unitName`, `factionDisplayName` or the datasheet helpers.

## 7. Out of scope

- Global search across units and stratagems (R7).
- QR codes.
- BattleScribe file import and export.
- Folders.
- Reordering units.
- Tournament features.
- Making Rules public (N9).

These are noted for later. None blocks the owner's complaints.
