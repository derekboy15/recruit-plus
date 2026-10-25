# Design: datasheets that say which model has what

*Owner's request, 25 Oct 2026. Brainstormed in chat; layout B chosen from mockups. This document is for approval before a
plan is written.*

## 1. Intent and why

A datasheet in Recruit+ is hard to read for any unit with more than one kind of model. Opening the Cadian Command Squad
shows seven stat lines with nothing saying which model each belongs to, and a pile of 30 weapons with nothing saying who
carries which. A player can't tell what a model in the squad actually does without looking at the physical model.

The owner wants it reorganised so every stat line, weapon and ability says which model it belongs to, with New Recruit
as the reference for a unit inside a list (screenshots shared in chat: a list of the unit's models with their gear, then
a stats table, a weapons table with counts, abilities, and keywords, model-specific keywords shown against the model).

**Root cause (investigation, 25 Oct 2026).** The problem is in the data, not only the screen:
- The data build (`packages/data/src/extract/units.ts`) flattens each unit into one list of model profiles, one list of
  weapons and one list of abilities (`UnitOut.models`, `.weapons`, `.abilities`). Nothing records which model a weapon or
  ability belongs to, so no screen can show it.
- Those lists hold every possible option, not the unit as fielded: the Command Squad's seven profiles include five
  optional attachés (Astropath, Master of Ordnance, Officer of the Fleet, Ogryn Bodyguard, Nork Deddog), and its weapons
  mix the default kit with every swap and relic.
- Model counts are wrong for some units: the Command Squad says `minModels 1, maxModels 1`; it is 5 models.
- The information exists. BattleScribe's tree has each model entry, the weapon entries under it, its option groups and
  their default selections; and a unit in a list already has the exact model and gear selections (the roster engine's
  `SelView`), which is how New Recruit shows "1x Cadian Veteran w/ Medi-pack: Frag grenades, Lasgun, Medi-pack".

## 2. Goals

1. **Every stat line, weapon and ability on a datasheet says which model it belongs to**, on all four screens that show
   one: the faction page datasheet, the unit picker's preview, a unit in the list editor, and Play mode.
2. **Two views, one layout family (layout B):**
   - **A unit on a faction page** (no list): stats and abilities first (the owner's priority), for the unit as it comes
     by default.
   - **A unit in a list:** New Recruit's order, built from the player's actual selections.
3. **The data build keeps per-model structure:** each model kind's own profile, its default gear, the abilities it (or
   its gear) grants, and the unit's options with who may take them; correct model counts.
4. **Play mode resolves attacks from each model's exact gear** (owner, 25 Oct 2026): mustering a saved list into a game
   army reads the per-model data by entry, replacing today's name matching and fallbacks ("use the only profile there
   is") wherever the tree attributes the gear. Gear labelled Unit (§7a) keeps today's behaviour.

## 3. The layouts

### 3.1 Faction page (no list) — layout B

1. Name, badges and the meta line as today (role · size · points · PL · base · Needs …).
2. **Stats table:** one row per kind of model in the default unit, labelled with its name and count ("Cadian Commander ×1",
   "Veteran ×4"). A degrading model keeps one row plus its wound-bracket strip, as today.
3. **Weapons table:** the default loadout, one row per weapon with a **Carried by** column ("Commander, 2 Veterans",
   "Everyone") and the weapon's profile; the weapon's special rule under its row, as today. Multi-profile weapons stay
   grouped as today.
4. **Options** (closed by default): the swaps and additions, each saying who can take it and what it replaces ("Any
   Veteran can replace their lasgun with one of: …"). Weapons only reachable through an option show their profiles here.
5. **Abilities:** each labelled with who has it: "Whole unit", a model name, or a piece of gear ("Veteran with
   Medi-pack"). Whole-unit rules first. Plain English by default with the official-wording switch, as today.
6. **Can also take:** optional models (the Command Squad's attachés), each with its points; tapping one shows its rows in
   the same tables.
7. Relic and chapter extras stay under "Also available", as today.
8. Keywords, with model-specific keywords shown against the model.

### 3.2 A unit in a list — New Recruit's order

1. **Models:** one row per model, or group of identical models, with exactly what it carries
   ("6x Shock Trooper: Lasgun, Frag grenades"; "1x Cadian Veteran w/ Medi-pack: Frag grenades, Lasgun, Medi-pack").
2. **Stats table:** only the kinds of model the unit has.
3. **Weapons table:** only weapons the unit's models carry, each with a count and Carried by ("Laspistol ×3 · Commander,
   2 Veterans").
4. **Abilities**, labelled with who has them; gear that grants one says so.
5. **Keywords**, model-specific ones against the model.

The same in-list view is used by the list editor's datasheet sheet and Play mode's datasheet. The unit picker's preview
uses the faction-page view (nothing is chosen yet).

## 4. Anti-goals (what would make this a failure)

1. **Wrong attribution:** a weapon or ability shown against the wrong model is worse than today's pile. Every
   multi-model unit's attribution must come from the BattleScribe tree (or the roster selections), never be guessed from
   names, and be checked by tests across every catalogue.
2. **Tables that don't fit a phone:** at 375 px wide the stats and weapons tables, Carried by included, must read without
   sideways page scroll (the app's existing rule; e2e already checks it).
3. **Losing options:** a faction page must still show every swap and addition a unit can take.
4. **A wall of rows:** identical models are grouped; units with many loadouts (special weapons per model) stay scannable.
5. **Breaking Play mode:** the engine's adapter (`packages/engine/src/data/adapter.ts`) and the code that turns a saved
   list into a game army (`packages/engine/src/data/muster.ts`) move onto the per-model data (see §2 goal 4); every
   engine test and the full-game scenario tests must stay green, and a unit must never lose a weapon it had before.

## 5. Non-goals

- New rules content or plain-English rewrites (texts are keyed by wording and keep their plain English).
- Changing how the list editor's unit editor (options and counts) works; only the datasheet views change.
- Matching New Recruit's styling; only its information order for the in-list view.

## 6. Constraints

- Source precedence as in the main spec: final GW changes > BSData v9.8.0 > Wahapedia > research library. Default
  loadouts come from BSData's tree (default selections / minimum constraints); Wahapedia's "is equipped with" text may
  be used to check them.
- Budgets stay green: catalogues ≤ 300 kB gzip each (Space Wolves is at 146 kB), startup JS ≤ 150 kB, precache
  ≤ 3.0 MB. Per-model structure must not duplicate profiles per model (reference them).
- Existing data and web tests stay green; changed expectations are updated with a reason.
- Mobile-first (375 × 812), plain English, curly apostrophes, sentence case.

## 7. Decided

- Layout B for the faction page (owner, from mockups).
- New Recruit's order for a unit in a list (owner).
- Fix it in the data build, not only the screens (my call: the screens can't show what the data has thrown away).
- Correct model counts as part of this (my call).
- The picker preview uses the faction-page view; Play mode uses the in-list view (my call).
- Play mode's attack resolution moves onto the per-model gear in this job, not later (owner).

## 7a. Settled after the builder check (my calls)

- **Gear and abilities the tree doesn't attach to a model.** About 57 of 467 units hang weapon options on the unit
  rather than a model, and 33 have no model entries. These rows are labelled **Unit** (no model named), never assigned to
  a model by name-guessing. "Everyone" is used only where BattleScribe says every model takes it (the existing
  `isUnitWideChoice` rule counts as BattleScribe saying so). Wahapedia's loadout text is not used to fill gaps.
- **Proof of attribution.** Automated checks across every catalogue: each weapon and ability shown against a model is
  reachable from that model's entry in the tree; default model counts match BattleScribe's limits. Plus hand-checked
  expectations for about ten units across the factions (the Cadian Command Squad among them).
- **The default unit** on a faction page is the unit as the list editor adds it: minimum size and default picks. Stat rows
  are grouped by profile ("Veteran ×4"). The weapon Type column stays. Psychic, Transport and Wound track sections stay.
  The Learn drills' datasheet uses the faction-page view.

## 8. Left to the builder

- The exact shape of the per-model data in `UnitOut` (or a new structure), as long as profiles and weapons aren't
  duplicated per model and the engine adapter keeps working.
- How "Carried by" is worded when a weapon is on most models ("Everyone", "All but the Sergeant", counts).
- How options are phrased from BattleScribe's groups and constraints.
- Visual details of the tables at phone width.
