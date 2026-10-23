# Rules Reference and plain English: known gaps (Milestone 3)

Milestone 3 shows every official rules text in plain English. Each text was checked automatically: numbers, dice and keywords must survive, and no copied wording is allowed. Each faction was also spot-checked by a reviewer. A few things are still open. Each line below says what a player would see.

## Official data we show as it is

- **Army rules we couldn't confirm.** About 13 army-rule rows are still shown because no source settles whether they are current: Grey Knights Frag Assault Launchers, Necrons Tomb Guardians, Orks Adrenaline Junkies and others. The audit that excluded 36 stale rows lists them all. Some may be 8th-edition leftovers.
- **Typos and run-together text in BSData wording.** Examples are "roll one 06" and "7.6Writhing Worldscape". "Official wording" shows these as they are; the plain English reads them correctly.
- **The Catacomb Command Barge** shows no CORE keyword on its datasheet, which is correct. The roster data the army builder uses still lists CORE. The builder doesn't read CORE, so a player sees no difference.
- **Amallyn Shadowguide** (Craftworlds) has one ability with no text.

## Stratagem lists

- **Larger factions list every stratagem from their codex, and from any sub-faction or detachment their catalogue allows.** Each stratagem's own text names the keywords it needs. The four smallest factions list only the stratagems their units can use: Legion of the Damned, Astra Telepathica, Servants of the Abyss and Harlequins.
- **Three relic requisitions sit under the group "Space Marines".** Honoured by Macragge, Gift of the Khans and Bequeathed by the Iron Council appear there rather than under the chapter's name.

## The checker

- **Some numbers aren't checked.** Values joined to a letter, such as "T5", aren't read as numbers. "One" and "first" are also skipped, because "one unit" appears everywhere. A plain text that changed one of these would still pass the checker; only the human spot-check would catch it.
- **Keyword case isn't checked.** Keywords match whatever their capitalisation. The style guide asks for CAPITALS, but the checker doesn't enforce it.

## Screens (small)

- On a datasheet, a weapon or psychic text with no plain English would show its official wording without the "not ready yet" label. Coverage is 100% today.
- "Send report" can be pressed twice while saving, which saves two reports.
- A malformed link hash (`#%E0%A4%A`) on a rules page shows the error screen instead of the page.
- The glossary filter treats T'au and T’au as different spellings.
- A very long unbroken note in "Your rules reports" overflows the card on a phone.

## Fixed in Milestone 8

- **Offline faction guide.** With no connection, a guide page used to say "No guide for this faction yet". It now shows the offline notice.
- **Faction secondary objectives** (the 169 distinct texts, Arks of Omen and Core Book) now have checked and spot-checked plain English (`packages/content/review/missions-faction-secondaries.md`).
- **Tables in official wording** used to run together ("VICTORY POINTS22334555"). They now show one row per line.

## Before deploy

- **Apply migration `0002_rules_reports.sql` to the real Supabase project,** then send one report end to end (`DEPLOY.md` steps 1.2 and 4.5). Until then, reports stay on the device that made them.
