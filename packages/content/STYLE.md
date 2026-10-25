# Writing plain-English rules for Recruit+

Recruit+ shows every datasheet ability, weapon ability, psychic power, army rule and stratagem in plain English by default, with the official wording one tap away. You write those plain-English versions. Players will trust them over the official text, so a wrong number, keyword or timing window is the worst mistake you can make. Accuracy beats elegance every time.

## The rules

1. **Write to the player.** Use "you", "your unit" and "this model", in short sentences.
2. **Put timing and conditions first.** For example: "In your Shooting phase, when this unit is chosen to shoot, …".
3. **Keep keywords in CAPITALS**, exactly as the official text has them: `CORE INFANTRY`, `<DYNASTY>`, `ADEPTUS ASTARTES`.
4. **Write numbers as digits.** Distances are `6"`, rolls `5+`, modifiers `+1` / `-1`, and dice `D6`, `2D6`, `D3+3`.
5. **Never add, drop or soften anything:** effects, restrictions, "once per battle" limits, timing windows, targets ("enemy" vs "friendly"), or "unmodified". If the official text is ambiguous, keep the ambiguity rather than guessing.
6. **No flavour text and no strategy advice.** Advice belongs in the faction guides. Don't refer to page numbers or books.
7. **Game terms** (Engagement Range, Objective Secured, Look Out, Sir, mortal wounds, Advance, Fall Back and so on) are explained in the Rules Reference, so use them as they are.
8. **"Rules update:" notes.** Some official texts end with a "Rules update:" note, our record of a later Games Workshop change. Your plain English must describe the rule **as updated**, and every number in the note must appear in it.
9. **Never copy the official wording.** Reword it in your own words. Short fixed phrases ("within Engagement Range of any enemy models") are fine; whole sentences are not.

## What the checker enforces

`npm run data:build` checks every entry against its official text. An entry that fails is not shown, and the app falls back to the official wording.

- **Missing tokens fail.** Every number, dice expression (`D6`, `2D6`, `D3+3`), roll (`5+`), modifier (`+1`), distance (`6"`) and keyword run (`NECRONS CORE`) in the official text must also appear in yours.
  - Keywords match case-insensitively, and a plural `s` is fine.
  - A bare number can be matched by any token with the same value. For example, official "add 2" is matched by your "+2".
  - Number words ("three", "first") count as digits.
- **Invented tokens fail.** Any dice, roll, modifier or distance in your text that the official text doesn't have fails the check. This catches "within 9"" written for "within 6"".
- **Copying fails.** Your text fails if it shares **12 or more consecutive words** with the official text. For official texts of 20+ words, it also fails if **half or more** of your word 4-grams appear in the official text. Copying can't be waived.
- **Waivers.** A missing or extra token can be waived only when it genuinely doesn't matter to the rule. Write the reason out. For example, `"waive": { "40000": "part of the book title \"Warhammer 40,000 Core Book\"" }`. Never waive a value just to make a mistake pass.

## The file format

Each shard is `packages/content/plain/<shard>.json`. It is an object keyed by the 12-character text key from the to-do list, with keys sorted:

```json
{
  "d978c436fd6e": {
    "name": "Lord of the Pyrrhian Legions (Aura)",
    "kind": "ability",
    "plain": "Aura: while one of your NECRONS CORE units is within 6\" of this model, each model in that unit gets 1 extra attack."
  }
}
```

`name` and `kind` are copied from the to-do list. `waive` is optional.

## The authoring loop

1. Run `npm run data:build` (once), then `npm run content:todo -- <shard>`. This writes `packages/content/todo/<shard>.json`: every text without a passing entry, with its `official` text, its `tokens`, and the `problem` if an entry exists but fails.
2. Write the entries into `packages/content/plain/<shard>.json`. Only use keys from your own to-do list; another shard's keys belong to another author.
3. Re-run `npm run data:build && npm run content:todo -- <shard>` until it says `0 to do`.
4. Run `npm test -w packages/data`.

## Option texts

Option texts are what the army builder says about each choice: sub-faction codes, Warlord traits, relics, stratagem upgrades, psychic powers and wargear abilities. Everything above applies to them, plus these rules:

- **The first sentence is the summary.** The builder shows an option's first sentence under its name, cut at 160 characters, and the full text behind ⓘ. Make that sentence say what the option does. If the timing or a condition makes it long, split it ("Once per battle, in your Command phase: …"). `merge-plain-draft` warns about any first sentence over 160 characters.
- **Never leave the summary as the official wording.** The builder labels an identical summary "Official wording".
- **One text can serve several options**, such as a Warlord trait in a codex and a supplement, or a code shared by successor chapters. Keep the official text's subject ("this WARLORD", "the bearer", "units with this code") so it reads right for each one.
- **Tiers set the order.** Write the most visible first:
  1. army choices (sub-faction codes, Army of Renown);
  2. Warlord traits;
  3. relics;
  4. unit options.

  A text that several options share takes the tier of its most visible one.
- **Each option text has one owner:** the shard that already holds its entry, otherwise the first info file it occurs in. The game system's texts go in `core`. Your to-do list only shows your own texts.

The option loop:

1. Run `npm run data:build`, then `npm run content:todo -- <shard> --tier <n>`.
2. Write a draft file outside the content files: `{ "<key>": { "plain": "…" } }`, adding `"waive"` only when needed.
3. Run `npx tsx packages/data/scripts/merge-plain-draft.ts <shard> <draft.json>`. It checks every entry and merges the passing ones into `packages/content/plain/<shard>.json`. Rewrite each failure and run it again until it says `0 failed`.
4. Run `npm run data:build && npm run content:todo -- <shard> --tier <n>` until nothing is listed at that tier. Then run `npm test -w packages/data`.

To rewrite an entry that already passes, list it by key: `npm run content:todo -- <shard> --keys <key> [...]`. Do this for a spot-check finding, or for a long first sentence you come back to. Then merge the new draft as in step 3; it replaces the old entry.

## Worked examples (real Necrons texts)

**Ability: Lord of the Pyrrhian Legions (Aura)**
- Official: While a friendly NECRONS CORE unit is within 6" of this model, add 1 to the Attacks characteristic of models in that unit.
- Plain: Aura: while one of your NECRONS CORE units is within 6" of this model, each model in that unit gets 1 extra attack.
- Why it passes: `NECRONS CORE`, `6"` and `1` all survive, and nothing is invented. The longest shared run is "is within 6" of this model" (6 words).

**Stratagem: Canoptek Reinforcement**
- Official: Use this Stratagem in the Reinforcement step of your Movement phase. Select one CANOPTEK PLASMACYTE unit from your army that has been destroyed. Set that unit up again anywhere on the battlefield within 3" of a friendly DESTROYER CULT unit and not within Engagement Range of any enemy models. You can only use this Stratagem once.
- Plain: Once per battle, in the Reinforcement step of your Movement phase: pick one of your CANOPTEK PLASMACYTE units that has been destroyed. Put it back on the battlefield, anywhere within 3" of one of your DESTROYER CULT units but not within Engagement Range of any enemy models.
- Why it passes: the timing, the target, `3"`, both keywords, the Engagement Range restriction and the once-only limit all survive. The wording is new apart from short fixed phrases.

**Weapon ability: Aeonstave (Melee)**
- Official: Each time an attack is made with this weapon, invulnerable saving throws cannot be taken against this attack.
- Plain: Your opponent can't use invulnerable saves against attacks made with this weapon.
- Why it passes: there are no tokens to keep, and it says the same thing in fewer words.

**Option text (Warlord trait): Blood-Fuelled Fury**
- Official: Each time this WARLORD makes a melee attack, an unmodified wound roll of 6 inflicts 1 mortal wound on the target in addition to any normal damage.
- Plain: When this WARLORD attacks in melee, each unmodified wound roll of 6 also deals 1 mortal wound to the target, on top of the attack's normal damage.
- Why it passes:
  - `WARLORD`, `6` and `1` survive, and so does "unmodified".
  - The longest shared run is "unmodified wound roll of 6" (5 words).
  - The whole text is one sentence of 146 characters, so the builder's one-line summary shows all of it.
  - The Tyranids Behemoth trait Monstrous Hunger has the same text, so one entry serves both. Keeping "this WARLORD" makes it read right for each.
