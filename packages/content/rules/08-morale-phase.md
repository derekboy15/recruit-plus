---
id: morale-phase
title: Morale phase
order: 8
summary: Units that lost models this turn take a Morale test, may lose more models to Combat Attrition, and every unit then checks its coherency.
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §8, 01_Core_Rules/Core_Rules_Turn_Sequence.md §1.2, 01_Core_Rules/Core_Rules_Turn_Sequence.md §1.5, 01_Core_Rules/Core_Stratagems.md §2, 01_Core_Rules/Terrain_Rules.md §3.3, 01_Core_Rules/Army_Building_Detachments_and_CP.md]
---
The Morale phase is the last phase of every turn. It checks whether units that took losses hold their nerve, then tidies up any unit whose models have ended up too spread out.

## What happens in the Morale phase

The phase has two steps, always in this order:

1. **Morale tests.** Each unit that lost models this turn takes a Morale test. A unit that fails loses a model, and may lose more to [Combat Attrition](#combat-attrition).
2. **Unit Coherency Checks.** Each player removes models from any of their units that are no longer in [unit coherency](/rules/basics#unit-coherency).

Both players' units take part, not just the units of the player whose turn it is. A unit that lost models to your opponent's shooting in your turn, for example, can still have to test.

## Which units test

A unit must take a Morale test if **one or more of its models were destroyed this turn**. Units that lost no models don't test. A unit that lost wounds but no whole models doesn't test either.

Each unit tests at most **once** per Morale phase.

The players take turns picking units to test, **starting with the player whose turn it is**. Finish each unit's test (and any Combat Attrition) before the next unit is picked.

## Morale tests

To take a Morale test:

1. Roll a D6.
2. Add the number of models from the unit that were destroyed **this turn**.
3. Compare the total with the **highest Leadership (Ld)** characteristic among the models in the unit.

If the total is **equal to or less than** that Leadership, the test is passed and nothing happens.

If the total is **higher** than that Leadership, the test is failed. **One model flees**: you choose which model in the unit it is, and remove it.

An **unmodified roll of 1 always passes**, however many models the unit lost.

### Fleeing models

A model that flees counts as **destroyed**. For mission scoring it counts as destroyed by your opponent. A fleeing model does **not** trigger rules that happen "when a model is destroyed", such as abilities that fire off when a model dies.

If a unit's last model flees, the whole unit counts as destroyed by your opponent.

## Combat Attrition

When a unit fails its Morale test, more models can flee after the first one.

1. After the first model flees, roll **one D6 for each model still in the unit**.
2. If the unit is **below Half-strength**, subtract 1 from each of those rolls.
3. For each result of **1**, one more model flees. You choose which.

So a unit at Half-strength or better loses a model on each 1. A unit below Half-strength loses a model on each 1 or 2, because a roll of 2 becomes 1 after the `-1`.

### Below Half-strength

A unit is **below Half-strength** when it has **fewer than half** the models of its Starting Strength. Starting Strength is the number of models the unit had at the start of the battle.

Exactly half is not below Half-strength. A unit that started with 10 models and has 5 left is not below Half-strength; with 4 left, it is.

## Unit Coherency Checks

Once all the Morale tests are done, every unit must pass a coherency check.

- If a unit is not in [unit coherency](/rules/basics#unit-coherency), its owner removes models from it, one at a time, until only one group of models in coherency is left.
- The owner chooses which models to remove.
- Removing them doesn't trigger "when destroyed" rules and doesn't make the unit take another Morale test.

Units most often fall out of coherency when casualties are taken from the middle of a spread-out unit, leaving models stranded at either end. Units of 6 or more models are the most at risk, because each of their models needs two neighbours rather than one.

## Ways to avoid or soften Morale

### Insane Bravery

**Insane Bravery** (2 CP) is a core stratagem. Use it before a unit takes a Morale test: the test is passed automatically, with no dice rolled. Because the test is passed, the unit also skips Combat Attrition.

- You can use it only **once per battle**.
- It doesn't stop the Unit Coherency Check later in the phase.

The Command Re-roll stratagem can't re-roll a Morale test or Combat Attrition dice. See the [stratagems page](/rules/stratagems) for the full wording of both.

### Better Leadership

A higher Leadership makes Morale tests easier to pass. Common sources include:

- **Inspiring Leader**, a Warlord Trait any Warlord can take: your units within `6"` of your Warlord get `+1` Ld.
- The [Inspiring](/rules/terrain#inspiring) terrain trait: units wholly within `6"` of the feature get `+1` Ld, sometimes only for the keywords listed with it.
- Faction and datasheet abilities, such as ones that let a unit use a nearby CHARACTER's Leadership or ignore modifiers to Combat Attrition. Check your codex.

## Quick reference

| Step | What you roll | What happens |
|---|---|---|
| Morale test | D6, plus the number of the unit's models destroyed this turn | Total higher than the unit's highest Ld: one model flees. An unmodified 1 always passes. |
| Combat Attrition (only after a failed test) | One D6 for each model left, `-1` to each if below Half-strength | Each result of 1: one more model flees. |
| Unit Coherency Check | No dice | Remove models until one group in coherency is left. |

Every model that flees or is removed in this phase is chosen by the unit's owner.

## Examples

### A unit that stays above Half-strength

A unit of 10 models with Ld 7 loses 3 models this turn, leaving 7.

1. You roll a 5 and add 3, for a total of 8. That's higher than 7, so the test is failed.
2. One model flees, leaving 6. The unit started with 10, so 6 is not below Half-strength.
3. You roll 6 dice for Combat Attrition, with no modifier. You roll a single 1, so one more model flees. The unit ends with 5 models.

### A unit below Half-strength

A unit of 10 models with Ld 7 is down to 3 models after losing 2 this turn.

1. You roll a 6 and add 2, for a total of 8. The test is failed and one model flees, leaving 2.
2. The unit is below Half-strength, so you subtract 1 from each Combat Attrition roll.
3. You roll 2 dice and get a 2 and a 5. The 2 becomes a 1, so one more model flees. The last model stays.

Had the first roll been a 1, the test would have passed, whatever the total.
