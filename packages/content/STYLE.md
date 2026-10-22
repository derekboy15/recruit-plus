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
