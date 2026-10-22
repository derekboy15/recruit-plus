---
id: psychic-phase
title: Psychic phase
order: 4
summary: How your PSYKER units manifest psychic powers, how your opponent can deny them, and what Smite and Perils of the Warp do.
sources: [01_Core_Rules/Psychic_Phase.md, 01_Core_Rules/Core_Rules_Turn_Sequence.md §4, 01_Core_Rules/Core_Stratagems.md, 05_Balance_Errata_and_Points/FAQs_Errata_and_Rules_Commentary.md]
---
The Psychic phase is the third phase of your turn, after the Movement phase and before the Shooting phase. Only you manifest powers in your own Psychic phase; your opponent can try to stop them.

If your army has no PSYKER units, you skip this phase.

## Who can manifest powers

A unit can attempt psychic powers in your Psychic phase if all of these are true:

- It has the PSYKER keyword.
- It is on the battlefield. Units embarked in a TRANSPORT can't do anything, so they can't manifest powers.
- It did not Fall Back this turn. TITANIC units are the exception: they can Fall Back and still manifest powers.

Advancing does not stop a unit from manifesting powers.

Each PSYKER's datasheet says how many powers it can attempt in your Psychic phase, and how many it can try to deny in your opponent's Psychic phase. For example, a datasheet might say it can attempt to manifest 2 psychic powers and deny 1.

### Picking psykers one at a time

Pick one of your eligible PSYKER units. Attempt every power you want with it, one after another. Then pick the next PSYKER unit. You can't come back to a unit later in the phase: each unit is picked only once per Psychic phase.

If one of your units is in the middle of an action (see [actions](/rules/glossary)), attempting a psychic power with it makes that action fail.

## Knowing powers

Every PSYKER knows **Smite** (see [Smite](#smite)). It also knows the powers on its datasheet, or the powers you pick for it from a **psychic discipline** (a list of powers, usually 6, that its faction can use). The datasheet says how many it can pick.

You choose a psyker's powers before the battle and write them on your army roster. You can't swap them to suit your opponent. You may instead write that the powers are random, then roll for them in front of your opponent once you know the mission.

Most powers in 9th edition codexes have a type:

- **Witchfire** powers attack an enemy unit, often the closest visible one.
- **Blessing** powers help your own units.
- **Malediction** powers weaken enemy units.

Each power's own rules say what it targets, its range and its effect.

## Manifesting a power

To manifest a power with the PSYKER unit you picked, follow these steps.

1. **Choose a power** the psyker knows and can still attempt this phase.
2. **Take a Psychic test.** Roll 2D6. If the total is equal to or higher than the power's **warp charge** value, the test is passed. Some abilities add to or subtract from this total.
3. **Your opponent may try to deny it.** See [Deny the Witch](#deny-the-witch).
4. **Resolve the power** if it was passed and not denied.

If you roll a double 1 or a double 6 on the Psychic test, the psyker also suffers [Perils of the Warp](#perils-of-the-warp). A double 6 still totals 12, so the power can succeed as long as the psyker survives.

### Limits on repeating powers

- **Each power once per battle round across your army.** Apart from Smite, you can't attempt the same power more than once per battle round, even with different psykers. If one Librarian tries a power and fails, no other psyker in your army can try it again that round.
- **Smite once per psyker.** Each PSYKER unit can attempt Smite only once per battle round. Several different psykers can each attempt Smite in the same phase, but it gets harder each time (see [Smite](#smite)).

Because of the first limit, an army with several psykers usually wants them to know different powers.

### Re-rolling a Psychic test

The [Command Re-roll](/rules/stratagems#strat-000002134002) stratagem (1 CP) can re-roll a Psychic test. You re-roll the whole 2D6, not just one die. See [how stratagems work](/rules/core-stratagems) for the limits on using stratagems.

## Deny the Witch

When your opponent passes a Psychic test, you can try to stop the power.

1. Pick one of your PSYKER units within 24" of the psyker that manifested the power.
2. Roll 2D6. This is a **Deny the Witch test**.
3. If your total is **higher** than the result of their Psychic test, the power is denied and has no effect. A tie is not enough: you must beat their total.

Only one Deny the Witch test can be taken against each power, so if it fails, the power goes off.

Each of your PSYKER units can deny only as many powers per phase as its datasheet says, usually 1.

You can use the [Command Re-roll](/rules/stratagems#strat-000002134002) stratagem on a Deny the Witch test.

Some units that aren't PSYKERS have abilities that let them deny powers too. Their datasheets explain how. These abilities work against psychic actions as well (see [Psychic actions](#psychic-actions)).

How hard is denying? If the psyker's test result was 7, you need 8 or more on 2D6. If it was 10, you need 11 or more, which is rare.

## Smite

Every PSYKER knows Smite. It is the most common psychic power in the game.

| Part of the power | What it does |
|---|---|
| Warp charge | 5, plus 1 for each other attempt to manifest Smite your army has already made this phase |
| Target | The closest visible enemy unit within 18" of the psyker |
| Effect | The target suffers D3 mortal wounds |
| Big result | If the Psychic test result was more than 10 (so 11 or 12), the target suffers D6 mortal wounds instead |
| Limit | Each PSYKER unit can attempt Smite once per battle round |

### Why Smite gets harder

The warp charge goes up by 1 for every other Smite attempt by your army in the same phase, whether those attempts passed or failed. Your first Smite of the phase needs 5, your second needs 6, your third needs 7, and so on. There is no upper limit, so with enough psykers a later Smite can need more than 12, which an unmodified 2D6 roll can never reach.

The order matters. If you plan to Smite with several psykers, the first one gets the easiest test.

### Smite and mortal wounds

Mortal wounds skip the wound roll and saving throws, including invulnerable saves. Only rules that ignore lost wounds can stop them. See [mortal wounds](/rules/glossary).

Some codexes give their psykers their own version of Smite, or let a psyker aim Smite at a different target. Those rules are on the faction's own pages.

## Perils of the Warp

Whenever a Psychic test (for a power or a psychic action) shows a double 1 or a double 6, the psyker unit **suffers Perils of the Warp**.

- The psyker unit suffers D3 mortal wounds.
- If this destroys the psyker while it is manifesting a power, that power fails automatically, even if the test was passed.
- If Perils of the Warp destroys the PSYKER unit, then just before its last model is removed, every unit within 6" of it suffers D3 mortal wounds. This hits your own units and enemy units alike.

A double 6 is a total of 12, so it passes almost any test. If your psyker survives the D3 mortal wounds, the power still goes off (unless it is denied).

Some faction abilities stop a psyker suffering Perils of the Warp, and a few make it worse. Check your codex.

## Psychic actions

A psychic action is a special task a PSYKER unit performs in the Psychic phase. Most come from mission **secondary objectives** in the Warpcraft category (see [secondary objectives](/rules/matched-play#secondary-objectives)).

- A PSYKER unit can attempt 1 psychic action in your Psychic phase **instead of** manifesting any psychic powers that phase.
- It can't attempt one if it Fell Back this turn, or if it is already performing another action.
- Each psyker can attempt only 1 psychic action per battle round.
- The action has a warp charge value. Take a Psychic test against it, just like a power.
- A double 1 or double 6 causes [Perils of the Warp](#perils-of-the-warp). If Perils destroys the psyker, the action fails.
- Your opponent can try to deny the action with a [Deny the Witch](#deny-the-witch) test, using a PSYKER within 24".

A psychic action is not a psychic power, but other rules treat it **as if** the psyker were manifesting a power. So abilities that let units deny powers can deny psychic actions too, and abilities that help a psyker manifest powers help with psychic actions as well.

The secondary objective that uses the action tells you where the psyker must be, what the warp charge is and how many victory points you score.
