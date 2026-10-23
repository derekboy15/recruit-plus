# Army builder: known rules gaps (Milestones 2 and 8)

The list builder checks the matched-play army-building rules, but a few cases are still open. Most of them need a source we don't have, or a rule the BattleScribe data doesn't hold. Each line below says what a player would see, and why it is still open.

## Fixed in Milestone 8

- **Hive Tyrant no longer has to be the Warlord.** Dataslate #7 (13 April 2023) removed the June 2022 Tyranids restrictions (`overrides/modifier-removals.json`, `overrides/constraints.json`).
- **Disciples of Be'lakor take two allies:** a Traitoris Astartes Patrol and a House Korvax Chaos Knights Super-heavy Auxiliary (`overrides/aoo-allies.json`, `armiesOfRenown`).
- **Arks of Omen ally restrictions are checked** (`overrides/aoo-allies.json`):
  - a Genestealer Cults army's Astra Militarum ally must be Brood Brothers;
  - a Drukhari ally Patrol must be a different type (Kabal, Wych Cult or Haemonculus Coven) from the Arks of Omen Detachment;
  - an Emperor's Children army may only ally Slaanesh Daemons.

  Source: Wahapedia's Arks of Omen GT page, Battle Brothers. The tests are in `packages/data/test/roster-gaps.test.ts`.

## May wrongly flag a legal list

- **Fallen with an Imperial Knights or Leagues of Votann ally.** If the Fallen count as IMPERIUM, the Arks of Omen pack may allow these allies. The app only lets the Fallen take a Chaos Knights Super-Heavy Auxiliary, so these allies are flagged as not allowed. *Still open:* neither the pack nor the codex text we have says which list the Fallen use.
- **Lion El'Jonson must be the Warlord.** The BattleScribe data makes this compulsory, so a Lion army with another Warlord is flagged. *Still open:* Wahapedia's final Lion datasheet has no such rule, but BSData outranks Wahapedia, and no GW document we could find settles it.
- **Named Chapter Masters, one per army.** The BattleScribe data allows only one named Chapter Master (or Master of Sanctity) in an army, so a list with two may be flagged wrongly. *Still open:* the research library only limits the Chapter Command upgrades.
- **Kill Team Strike Force at Arks of Omen sizes.** This Deathwatch army of renown is still offered at Incursion and Strike Force, so the app may offer an option that isn't legal. *Still open:* it was reportedly retired in January 2023, but no source we have confirms it.
- **Disciples of Be'lakor's Patrol comes only from the Chaos Space Marines catalogue.** In the BattleScribe data, only Chaos Space Marines units carry the TRAITORIS ASTARTES keyword, so a Death Guard, Thousand Sons or World Eaters Patrol isn't offered as Be'lakor's Traitoris Astartes ally.

## May miss a problem

- **Chaos Knights Dreadblade ally.** A squadron of 2–3 War Dogs is accepted as the "single Dreadblade" ally. *Still open:* the rule's wording is unclear on this.
- **Agents of the Imperium as guests.** The app lets Agents join an Astra Militarum Brood Brothers detachment, which the rules forbid. It also lets several Agents join one detachment, not just one per detachment.
- **Sub-faction keywords.** Chapters, regiments and similar keywords (KRIEG, CADIAN and so on) are not checked when units share a detachment. *Still open:* the BattleScribe data doesn't mark them consistently enough to check.
- **Legion of the Damned Vanguard with no HQ.** This is an 8th-edition rule that isn't on the final datasheet, so the app doesn't check it either way.
- **UNALIGNED units in a detachment.** The app ignores UNALIGNED units in its faction checks. *Still open:* whether they can share a detachment with a faction isn't settled.
- **Daemonic Pact's 25%.** The app treats the 25% Power Level limit as deciding whether the Daemons gain AGENT OF CHAOS, not as a legality cap, so a larger Daemons detachment isn't flagged.
- **One Inquisitor per all-Inquisition detachment.** The app doesn't check this.
- **Haemoxytes.** The data leaves the AELDARI keyword off this unit, so an army-faction problem involving it may be missed.
- **Points and Power Level disagreements.** Sergeant Telion (PL 3 here, 4 on Wahapedia), Commander Dante (PL 9 here, 8 on Wahapedia) and Kâhl (100 pts here, 90 on Wahapedia) follow the BattleScribe data. *Still open:* no final GW source settles them, so a total may be off by that much.
- **Fixed Warlord Traits at Combat Patrol and Onslaught.** Named Necrons Warlords (the Silent King, Anrakyr, Szeras, Trazyn, Orikan) don't have to record their automatic trait, so a list can leave it out without a warning.
