# Design: "Recruit+": a learn-to-play army builder and game app for Warhammer 40k 9th Edition

*Working name (my call). This is the design for approval. Once it's approved, a detailed step-by-step implementation plan is written for each milestone (superpowers:writing-plans), starting with Milestone 1.*

## 1. Context: intent and why
New Recruit is the best-known army builder, but it fails newcomers in four ways:
- It assumes you already know detachments, slots and keywords, and its errors don't explain themselves.
- It doesn't show what units, rules or stratagems actually do.
- It is clunky on a phone.
- It stops once the list is built.

This app does everything New Recruit does: build and check a list for any 9th Edition faction. Its first job, though, is to take someone who has never played 40k all the way to playing real games. It does that two ways:
- **On screen:** guided lessons that unlock a free two-player sandbox game on one device.
- **At a real table:** a companion that walks a game turn by turn.

**Success:** a newcomer can sign up, learn the core rules through short hands-on lessons, build a legal list for any faction, play a full game on screen, and then run a real game at a table with the app guiding them.

## 2. Goals, non-goals, anti-goals
**Goals (user's decisions):**
- **Public website, mobile-first:** works well on phones, tablets and desktop.
- **Required sign-in:** lists, lesson progress and saved games sync across devices.
- **All factions, including Legends and Forge World:** all 52 BattleScribe 9th Edition catalogues (v9.8.0; library catalogues are imported by playable ones rather than chosen directly), in both the army builder and the sandbox.
- **Learning path:** guided tutorials unlock a two-player, same-device sandbox.
- **Sandbox rules:** core rules are fully automated for every army. Faction rules are **assisted**: shown as context prompts, plus a general toolkit for applying their effects. They are not individually coded.
- **Table companion:** one device tracks the whole game.
- **Rules version:** final 9th Edition state. That means the Arks of Omen army building and GT missions, the 13 Apr 2023 Balance Dataslate, and final points.
- **Rules text:** plain English by default, with a toggle to see the official wording.
- **Look:** a useful tool first. Clean and modern, with restrained grimdark accents (dark theme, brass and red accents).
- **Builder:** Claude builds across sessions, milestone by milestone, at whatever pace quality needs. There is no deadline. The user tests as we go.

**Non-goals for v1:**
- Online remote play.
- AI opponent.
- Live shared table games across phones.
- Other editions or eras.
- Crusade and Boarding Actions modes.

**Anti-goals (the user's "would wince" list):**
- **Wrong rules:** the engine teaching or enforcing a rule incorrectly is the worst failure. Rules logic needs exhaustive tests.
- **Half-finished factions:** every catalogue must build valid lists and be playable in the sandbox.

## 3. The four parts

### 3.1 Learn
**Lesson path:** 15 short lessons of 2–5 minutes each:
1. What 40k is
2. Reading a datasheet
3. The attack sequence and wound table
4. Command phase and Command Points
5. Movement
6. Psychic
7. Shooting
8. Charge
9. Fight
10. Morale and Combat Attrition
11. Objectives and scoring
12. Stratagems
13. Terrain
14. Building an army
15. Mission setup

Each lesson pairs a plain-English explanation with an interactive **drill** on a small sandbox board, using real units and dice. Finishing the path unlocks **"Your first game"**: a 500-point Combat Patrol sandbox game with hints on.

**Rules Reference:** searchable plain-English core rules, glossary, terrain traits and core stratagems. Includes the official-wording toggle.

**Faction guides:** one per faction. "How this army plays", army rules in plain English, and key units. Summarised from the research library.

### 3.2 Army Builder (the "better New Recruit")
- **Setup:** pick faction, sub-faction and battle size, then detachments.
- **Units:** a searchable unit list grouped by battlefield role. Each unit shows its full datasheet with abilities in plain English (official-wording toggle). Wargear has big touch controls. Points and Power Level update live.
- **Validation:** problems are explained in plain language, with a fix. Example: "Your Battalion needs 1 more Troops unit. Add Necron Warriors or Immortals." Covers points, force organisation, Rule of Three, Warlord, unique units and wargear limits.
- **Sharing:** a text export, and a share link that **opens read-only without sign-in**.
- **Lists** are saved to the account and used by both the sandbox and the companion.

### 3.3 Sandbox (on-screen game)
**Board:** top-down at real scale, with real base sizes. Pass-and-play on one device.
- Drag to move, with live inch rulers and range rings.
- Hard limits on Move, Advance, coherency and engagement range.

**The engine automates all core rules:**
- Pre-game sequence: deployment, Strategic Reserves, deep strike and reinforcements, pre-battle redeploys.
- Command phase and CP.
- Movement: advance, fall back, difficult ground, FLY, aircraft.
- Transports: embark, disembark, emergency disembarkation.
- Psychic phase: tests, Deny the Witch, Smite, Perils.
- Shooting:
  - range and line of sight
  - cover and terrain traits
  - Look Out Sir
  - Blast; Heavy, Rapid Fire, Assault and Pistol weapons
  - Monster/Vehicle shooting while in engagement range
  - the attack sequence, damage, Feel No Pain and degrading profiles
- Charge, overwatch and Heroic Interventions.
- Fights: fight order, pile in and consolidate.
- Morale and Combat Attrition.
- Actions.
- Objectives and VP scoring, core stratagems, the battle-round structure, and the end of the game.

**Faction assistance:** at each step the app lists the relevant faction abilities and stratagems for the units involved.
- **Common modifiers are one tap:** re-rolls, ±1 to hit/wound/save, +AP/D, Feel No Pain, mortal wounds, extra attacks, ignore cover.
- **Manual adjust toolkit:** handles rules that change the flow of the game. It can:
  - move or redeploy any model
  - add, return or remove models and wounds
  - replace a die result
  - give an extra activation (shoot, fight or move again)
  - spend or gain CP

  Every adjustment is logged and can be undone. This is how reanimation, Cult Ambush, Miracle dice and similar rules work for every faction without per-faction code. *(My call.)*

**Other:** hints toggle, undo within a phase, full game log, and saved, resumable games.

### 3.4 Table Companion (real models)
- **Setup:** pick both lists, or your list plus the opponent's faction. Then pick the mission and secondaries.
- **During the game:**
  - a phase-by-phase checklist with beginner prompts
  - CP and VP tracking for each player
  - primary and secondary scoring each round, with the mission rules shown
  - stratagems filtered by the current phase and your list
  - rules search, a dice roller and an attack-odds calculator
  - a game log
- **After the game:** a summary.

## 4. Settled details (from the reviewer check; marked as my calls)
- **Battle sizes and missions:**
  - **Incursion (1,000 pts) and Strike Force (2,000 pts):** Arks of Omen GT missions and army-building rules.
  - **Combat Patrol (500 pts) and Onslaught (3,000 pts):** Core Book Eternal War missions and Core Book detachments, because Arks of Omen didn't cover those sizes.
  - **Board sizes:** Combat Patrol 44"×30", Incursion 44"×60", Strike Force 44"×60", Onslaught 44"×90". *(My call.)*
- **Mission geometry:** deployment zones and objective positions are transcribed from Wahapedia's 9th Edition mission pages and maps into JSON, then checked against the research library. *(My call.)*
- **Source precedence:** a single order, used by both the data-fix layer and the engine tests. *(My call.)*
  1. Final GW changes (13 Apr 2023 Dataslate, final points)
  2. BSData v9.8.0
  3. Wahapedia snapshot
  4. Research library

  Every manual correction lives in one reviewed overrides file, with a source note.
- **Offline:** local-first from Milestone 1. Lists and in-progress games are stored in IndexedDB and synced to Supabase when online. Conflicts are resolved by last-write-wins per document, with a per-game event log. The companion works with no signal once you're signed in. *(My call.)*
- **Plain-English text:**
  - **Who writes it:** Claude writes it.
  - **Automated check:** confirms every number, keyword and dice expression in the official text also appears in the plain-English version (or is flagged).
  - **Review:** Claude spot-checks each faction.
  - **User reports:** a "report a rules error" button feeds an issues list.

## 5. How it gets made (my calls, approved as defaults)
- **Frontend:** React + TypeScript (Vite), installable PWA, responsive and mobile-first.
- **Accounts and storage:** Supabase (Postgres, Auth with email magic link plus Google, Row-Level Security). Shared lists get a public read-only policy.
- **Hosting:** Vercel, free tier.
- **Sandbox board:** a canvas (PixiJS), with touch drag, pinch-zoom and pan.
- **Rules engine:** a pure TypeScript package (`packages/engine`).
  - Deterministic, with seeded dice.
  - Event-sourced: every action is an event, which gives undo, the game log, saved games and sync.
  - Exhaustive Vitest tests, including a "rules scenarios" suite written from the research library's rule numbers. Example checks: coherency 2"/5", engagement range 1"/5", charge 2D6 within 12", Blast 3 / max.
  - Lessons, the sandbox and the companion all run on it.
- **Repository:** a new git monorepo at `L:\9th Edition\app\` (pnpm workspaces): `apps/web`, `packages/engine`, `packages/data` (build pipeline plus generated JSON), `packages/content` (lessons, guides).

## 6. Data
- **Army data:** BSData `wh40k-9e` v9.8.0, which provides units, profiles, wargear, points, constraints and 25 detachment types.
  - A build-time pipeline converts it to compact JSON per faction. It uses `bsdata-parser` (MIT) plus our own resolver for entryLinks, modifiers, conditions and repeats.
  - This is the hardest data task. It gets snapshot and "known-legal / known-illegal list" tests for every catalogue.
- **Official text:** a committed snapshot of the Wahapedia 9th Edition CSV export (last updated 2023-06-26). It covers stratagems, warlord traits, psychic powers, relics, abilities, base sizes and secondaries.
  - It is matched to BSData by normalised name, with an overrides table for mismatches.
  - Credited "powered by Wahapedia".
- **Plain-English content:** the core rules, glossary, lessons and faction guides come from the research library at `L:\9th Edition\`.
  - Inconsistencies the inventory found get fixed in the library first:
    - the Core Book secondaries count (16 vs 17)
    - whether Aircraft caps came from the Core Book or a dataslate
    - the Indirect Fire penalty missing from the turn sequence
  - Goonhammer links on tabletopbattles.com need checking.

## 7. Constraints and risks
- **Legal:** a public site showing GW names, points and official wording risks takedown requests. The user accepted this. A non-affiliation disclaimer goes on every page, and plain English is the default.
- **Frozen data:** both datasets are final (2023). We own any corrections.
- **Size:** a multi-month project, delivered in milestones. Each milestone is usable on its own and covers every catalogue within its scope.
- **Legends and Forge World:** Titans and super-heavies need the engine to handle big footprints and Titanic rules from the start.

## 8. Milestones
1. **Foundation:**
   - monorepo, app shell (PWA, routing, theme), Supabase auth and local-first storage
   - CI with Vercel previews
   - data pipeline: BSData + Wahapedia → JSON for all 52 catalogues, with data tests
2. **Army Builder:** builder, validation with plain-language fixes, datasheets (plain-English and official), sharing and export.
3. **Rules Reference and faction guides**, including plain-English generation and the automated cross-check.
4. **Rules engine**, written test-first:
   - geometry and measurement
   - movement, transports and reserves
   - psychic, shooting, charge and fight
   - morale, actions, scoring and stratagems
5. **Sandbox UI** on the engine: board, terrain presets, deployment, faction assistance and the manual toolkit, saved games.
6. **Learn path:** 15 lessons with drills, then "Your first game".
7. **Table Companion:** missions (Arks of Omen GT plus Core Book), checklist, tracking, scoring, odds calculator.
8. **Polish and launch:** phone performance, accessibility, full offline audit, disclaimer and legal pages, production deploy.

## 9. Left to the builder
- Component library and state management.
- Exact database schema.
- Line-of-sight algorithm: 2D footprint-based Obscuring/Dense model.
- Terrain layout presets to ship.
- Exact lesson scripts.

## 10. Verification (each milestone)
- **Tests:**
  - Engine: Vitest unit and scenario tests, each tied to a rule citation.
  - Data: tests for every catalogue (parses, has profiles and points, sample legal and illegal lists validate correctly).
  - UI: Playwright end-to-end tests at phone (375×812) and desktop viewports.
- **Manual check:** run the dev server and walk the milestone's user flows in the built-in browser at mobile size, with screenshots.
- **Deploy check:** a Vercel preview deploy for the user to test on their phone before the next milestone starts.
