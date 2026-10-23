# Spot-check: faction secondary objectives (Milestone 8)
Sample: 34 of 169 distinct texts (20%, seed `missions`: `npm run content:todo -- --sample missions 34`), plus every scoring table (below).

Each plain text was compared with its official text for: when VP are scored, how many, caps, conditions (control, range, wholly within, destroyed by whom), action and psychic action rules, and keywords.

| Key | Name | Kind | Verdict | Note |
|---|---|---|---|---|
| 0504cead4256 | Might of Terra (Adeptus Custodes) | secondary | PASS | |
| 5298102d776e | Sorcerous Prowess (Thousand Sons) | secondary | PASS | |
| 32dcef2964c6 | Death from Above (Blood Angels) | secondary | PASS | |
| fae7f7a98a0a | Synaptic Insight (Tyranids) | secondary | PASS | |
| 2fa0b62b2dee | Sow the Seed, Reap the Fear (Night Lords) | secondary | PASS | |
| 3bd317fd766d | Stand Vigil (Adeptus Custodes) | secondary | PASS | |
| f1fe53bcd824 | Sacred Grounds (Adepta Sororitas) | secondary | PASS | |
| c610e2e998c7 | Destroy the Daemon (Grey Knights) | secondary | PASS | |
| 4a094eb2cf4c | Hidden Archeovault (Adeptus Mechanicus) | secondary | PASS | |
| 13d1aa846e22 | Despoilers of Reality (Chaos Daemons) | secondary | PASS | |
| ab8042e34e65 | Grudge Match (Leagues of Votann) | secondary | PASS | |
| 92ea69cff21a | Herd the Prey (Drukhari) | secondary | PASS | |
| 6334cd271e44 | Eradication of Flesh (Adeptus Mechanicus) | secondary | PASS | |
| 090400ae0e70 | Hidden Archeovault (Adeptus Mechanicus) | secondary | PASS | |
| e81c8f6f808f | Slay the Heretic (Adepta Sororitas) | secondary | PASS | |
| 0b32ae04aacb | Cripple Stronghold (Deathwatch) | secondary | PASS | |
| 8b39d84252ac | Raid and Reave (Red Corsairs) | secondary | PASS | |
| edaad9b43835 | Mutate Landscape (Thousand Sons) | secondary | PASS | |
| b76d3e30865c | Prospects of Wealth (Leagues of Votann) | secondary | PASS | |
| 37bb5b9a8fed | Weave Veil (Aeldari) | secondary | PASS | |
| 25bbac1de09a | The Ancestors Are Watching (Leagues of Votann) | secondary | PASS | |
| 51da523eda2e | A Leap of Faith (Adepta Sororitas) | secondary | PASS | |
| 01f121115179 | Spread the Sickness (Death Guard) | secondary | PASS | |
| 7c254743bba3 | A Clean Victory (T’au Empire) | secondary | PASS | |
| 67fa32423fd8 | Destroy the Daemon (Grey Knights) | secondary | PASS | |
| bad0fe50fca3 | Yield No Ground (Imperial Knights) | secondary | PASS | |
| 4ee7ca946190 | Ancient Machineries (Necrons) | secondary | PASS | |
| 2fd7ca2b4bcf | The Treasures of Aeons (Necrons) | secondary | PASS | |
| 72429aff5fc1 | Get Da Good Bitz (Orks) | secondary | PASS | |
| a371496499ed | Honour of the House (Imperial Knights) | secondary | PASS | |
| a81d9dee5c3c | Aerospace Targeting Relays (T’au Empire) | secondary | PASS | |
| d88f9272f375 | Code of Combat (Necrons) | secondary | PASS | |
| b8a337eae82c | By Lasgun and Bayonet (Astra Militarum) | secondary | PASS | |
| ff6b5ecd03bb | The Treasures of Aeons (Necrons) | secondary | PASS | |

## Scoring tables (all checked)
Wahapedia's tables reached the app run together ("VICTORY POINTS22334555") until Milestone 8 fixed `htmlToText`. Every plain text with a table was checked row by row against the rebuilt table:
- A Leap of Faith (Arks of Omen);
- Stubborn Defiance (both packs);
- Sabotage Critical Location (both packs);
- Purifying Ritual (both packs);
- The Treasures of Aeons (both packs);
- Aerospace Targeting Relays (both packs);
- A Fitting Challenge;
- Duel of Honour.

All pass.

## Official texts kept as written, for the record
- **Rise to Glory:** whether the +2 for TITANIC or the enemy WARLORD needs the 10–19 Wounds condition is unclear. The plain text keeps the sentence shape.
- **Wording that omits details:**
  - Destroy the Daemon (Core Book) and Glory Kills don't say "enemy".
  - Bolster Barricades doesn't say "different" objective markers.
  - Several actions have no "still within range" completion condition.

  Nothing was added.
- **Broodswarm:** capped at 5VP, but its three 1VP conditions can't reach that. Kept as written.
- **Typos read as meant:** "one of more" (The Ancestors Are Watching), "fist turn" (Martial Interdiction) and "Burn Empire action" (Burn Empires).

## Data fixes found during this work
- **Tables in Wahapedia texts:** `htmlToText` now writes a table's rows as lines of " | " cells. This affects 47 texts: abilities, a psychic power, a stratagem and secondaries. Their plain-English entries moved to the new text keys.
- **Mislabelled Core Book secondaries:** For the Dark Gods, Rise to Glory and The Long War were filed under Imperial Knights in Wahapedia's Core Book data. They are now Chaos Space Marines (`overrides/secondary-corrections.json`).
