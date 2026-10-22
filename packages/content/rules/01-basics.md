---
id: basics
title: The basics
order: 1
summary: Datasheets, dice, measuring, line of sight, unit coherency, Engagement Range and how a battle round is put together.
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §1, 01_Core_Rules/Glossary_and_Keywords.md, 01_Core_Rules/Terrain_Rules.md §3.3]
---
These are the ideas every other rule is built on. Read this article first: the phase articles assume you know what a datasheet, a modifier, unit coherency and Engagement Range are. Any term you don't recognise is in the [glossary](/rules/glossary).

## Units, models and datasheets

Your army is made of **units**. A unit is one or more **models** that all come from the same **datasheet**. Units in your army are *friendly*; units in your opponent's army are *enemy*.

A datasheet gives the profile of each model in the unit. These are its characteristics:

| Stat | Name | What it does |
|---|---|---|
| M | Move | How far the model moves, in inches. AIRCRAFT have a minimum and a maximum, such as `20-60"`. |
| WS | Weapon Skill | The D6 score the model needs to hit in melee. |
| BS | Ballistic Skill | The D6 score the model needs to hit with ranged weapons. |
| S | Strength | How hard its attacks hit. Compared with the target's Toughness. |
| T | Toughness | How hard it is to wound. |
| W | Wounds | How much damage it can take before it is destroyed. |
| A | Attacks | How many melee attacks it makes. |
| Ld | Leadership | Used for Morale tests. |
| Sv | Save | Its armour save: the D6 score it needs to stop a wound. |

Each weapon has its own profile: Range, Type (Assault, Heavy, Rapid Fire, Grenade, Pistol or Melee, plus a number of shots), S, AP, D and any abilities. Some weapons have a minimum and maximum range, such as `6"-48"`. They can't target a unit that is wholly within the minimum range.

Some big models get worse as they are hurt. Their datasheet has a **damage table**: as the model loses wounds, some of its characteristics drop.

### Keywords

Every datasheet lists **keywords**, such as INFANTRY, CHARACTER, VEHICLE or FLY. Faction keywords (such as IMPERIUM or ADEPTUS ASTARTES) work the same way, and also matter when you build your army. A rule that names a keyword only affects units or models that have it. Plurals don't matter: CHARACTER and CHARACTERS are the same keyword.

Keywords in angle brackets, like `<CHAPTER>` or `<HIVE FLEET>`, are placeholders. You choose what each one means when you add the unit to your army. Any rule that uses the same bracketed keyword uses your choice.

If a unit's models have different keywords, the unit counts as having all of them for rules that affect the whole unit. A rule that affects individual models only affects the models that have the keyword themselves.

### Starting Strength and Half-strength

A unit's **Starting Strength** is the number of models in it at the start of the battle. A unit is **below Half-strength** when it has fewer than half that many models left. A unit of 20 with exactly 10 left is not below Half-strength.

### The Most Important Rule

If you and your opponent can't work out how a situation should be resolved, agree a sensible answer together. If you can't agree, roll off and the winner decides.

## Dice

The game uses six-sided dice.

- **D6** means roll one die.
- **D3** means roll a D6 and halve the result, rounding up. So 1-2 is 1, 3-4 is 2 and 5-6 is 3.
- **2D6** means roll two dice and add them together.
- A roll written as `3+` means you need a 3 or more.

**Roll-offs.** When a rule says to roll off, each player rolls a D6 and the highest wins. If it's a tie, roll again. You can never re-roll or modify a roll-off.

**Random characteristics.** If a unit has a random Move, roll once for the whole unit each time it moves. Other random values, such as a weapon with D6 shots, are rolled separately for each model or weapon.

**Rules that happen at the same time.** If two rules would happen at once during a turn, the player whose turn it is decides the order. Before or after the battle, roll off to decide.

## Re-rolls and modifiers

### Re-rolls

A re-roll lets you roll a die again and use the new result. You always re-roll **before** applying any modifiers. A single die can never be re-rolled more than once, even if two different rules would let you.

If a rule refers to an **unmodified** roll, it means the result after any re-rolls but before any modifiers.

### Modifiers

Modifiers change a dice roll or a characteristic, such as `+1` to hit or `-1` to the Leadership characteristic. When several apply, use this order:

1. Rules that **set** a value to a fixed number.
2. Division.
3. Multiplication.
4. Addition.
5. Subtraction.

Round any fractions up at the end. Wargear that changes a characteristic is applied along with all the other modifiers. For example, a Strength 4 model with a weapon that doubles its Strength and a `+1` Strength buff has Strength 9, not 10.

Strength, Toughness, Attacks and Leadership can never be reduced below 1. A characteristic shown as "-" can never be modified.

**Hit and wound caps.** A hit roll or a wound roll can never be modified by more than `+1` or `-1` in total. Add up all the modifiers from both sides, then cap the result. Save rolls have no such cap.

**Unmodified 1s and 6s.** An unmodified hit roll or wound roll of 6 always succeeds, and an unmodified 1 always fails. An unmodified saving throw of 1 always fails.

## Measuring

You can measure any distance at any time.

Measure between the closest points of the two models' **bases**. If a model has no base, such as most vehicles, measure to its **hull**: any part of the model, including turrets and sponsons.

- A model is **within** a distance if any part of it is within that distance.
- A model is **wholly within** a distance only if every part of it is.
- A unit is within a distance if any of its models is. It is wholly within only if all of its models are.

When a rule tells you to set a unit up a certain distance from something, such as "more than `9"` away from enemy models", measure that distance **horizontally**. Height doesn't help you get closer, and a model on a high floor still blocks the area below it.

## Visibility

Many rules, such as choosing a target to shoot, need one model to be able to **see** another.

This is true line of sight: if any part of your model can see any part of the other model, that model is **visible**. A unit is visible if any of its models is visible.

Terrain can change this. The most important example is the **Obscuring** trait: a model can't see through or over an Obscuring feature that is at least `5"` tall, even through windows or gaps. Models on or within that feature can see and be seen normally. AIRCRAFT and models with a Wounds characteristic of 18 or more can still be seen through Obscuring terrain, but only if the firer can physically see them. Solid walls still block the view.

> **Tip:** Obscuring and other terrain traits are added on top of normal line of sight. They never let you see something you couldn't physically see.

## Unit coherency

The models in a unit must stay close together. This is called **unit coherency**.

- Every model must be within `2"` horizontally and `5"` vertically of at least **one** other model from its unit.
- If a unit has **6 or more** models, every model must instead be within `2"` horizontally and `5"` vertically of at least **two** other models from its unit.

**When it matters.** A unit must end every kind of move in coherency. If it can't, it can't make that move. If you can't set up a unit's models in coherency, the models you can't place are destroyed.

**Coherency checks.** At the end of every turn, in the Morale phase, each player checks their units. If a unit is out of coherency, its owner removes models one at a time until only a single group of models in coherency is left. These removed models don't trigger rules that happen "when a model is destroyed", and they don't cause extra Morale tests.

> **Tip:** Because big units need two neighbours, a unit of 5 can spread out in a line, but a unit of 6 or more has to stay in a tighter group.

## Engagement Range

A model is within **Engagement Range** of an enemy model while it is within `1"` horizontally and `5"` vertically of it. A unit is within Engagement Range of an enemy unit if any of its models is within Engagement Range of any model in that unit.

Engagement Range is how the game decides who is in combat. Units within Engagement Range of each other:

- can't make Normal Moves or Advances in the Movement phase. They can only Fall Back or Remain Stationary (see [Fall Back](/rules/movement-phase#fall-back)).
- usually can't shoot, apart from Pistols and the Big Guns Never Tire rule for VEHICLE and MONSTER models.
- can only be shot at by the enemy units they are in Engagement Range of, and only with those same exceptions.
- can fight in the Fight phase.

You can't set up a model within Engagement Range of an enemy model unless a rule says you can. One example is a unit arriving from Strategic Reserves right at your own battlefield edge (see [Strategic Reserves](/rules/movement-phase#strategic-reserves)).

The `5"` vertical part means models can fight across the floors of a ruin, or against a tall or hovering model.

> **Tip:** Older rules said "within `1"`" for being in combat. Wherever you see that in older material, the current rule is Engagement Range.

## The battle round

A battle is played in **battle rounds**. In each battle round, both players take one **turn**. The same player always goes first in every battle round; the mission tells you who that is. Most matched play missions last 5 battle rounds.

Each turn has seven **phases**, always in this order:

1. **Command phase.** You gain Command Points and use Command-phase rules. See [Command phase](/rules/command-phase#what-happens-in-the-command-phase).
2. **Movement phase.** First you move units, then you set up reinforcements. See [Movement phase](/rules/movement-phase#the-move-units-step).
3. **Psychic phase.** Your PSYKER units try to manifest powers, such as [Smite](/rules/psychic-phase#smite).
4. **Shooting phase.** Your units fire their ranged weapons. Some characters are protected by [Look Out, Sir](/rules/shooting-phase#look-out-sir).
5. **Charge phase.** Your units [charge](/rules/charge-phase#charging) into combat. Then your opponent's characters can make Heroic Interventions.
6. **Fight phase.** Units in combat fight, charging units first. Both players' units fight in this phase.
7. **Morale phase.** Units that lost models take Morale tests, then both players check unit coherency.

Mostly, only the player whose turn it is acts. Some rules let the other player react, such as firing Overwatch at a charging unit or fighting back in the Fight phase.

### Out-of-phase rules

Some rules let a unit act "as if it were" another phase, for example shooting as if it were the Shooting phase. When that happens, use all the normal rules for that phase. However, you can't use Stratagems that are limited to that phase on it.

Any move that doesn't say what type of move it is counts as a Normal Move. So a rule that says "move as if it were the Movement phase" doesn't let the unit Advance unless it says so.

### Auras

An **aura** affects units within a stated range of the model that has it. The model is always within range of its own aura. Auras with the same name don't stack: a unit can only benefit from one of them at a time. A CHARACTER can't use its auras while it is performing an action.
