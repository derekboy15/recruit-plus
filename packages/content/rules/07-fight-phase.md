---
id: fight-phase
title: Fight phase
order: 7
summary: Who fights and in what order, then how a unit piles in, makes its close combat attacks and consolidates.
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §7, 01_Core_Rules/Core_Rules_Turn_Sequence.md §3.5, 01_Core_Rules/Core_Stratagems.md §2, 01_Core_Rules/Terrain_Rules.md §3, 05_Balance_Errata_and_Points/FAQs_Errata_and_Rules_Commentary.md §2.3]
---
The Fight phase is where close combat happens. Both players fight in this phase, whoever's turn it is: units that charged go first, then the players take it in turns to pick units until every unit that can fight has fought.

## Who can fight

A unit is **eligible to fight** if, when it is picked, either of these is true:

- it is within [Engagement Range](/rules/basics#engagement-range) of an enemy unit; or
- it made a charge move this turn.

Each unit fights **once** per Fight phase, unless a rule says otherwise.

Eligibility can change during the phase. When an enemy unit consolidates, it may move into Engagement Range of one of your units that wasn't fighting before. That unit is now eligible, and you can pick it later in the same phase.

A unit that is eligible doesn't have to have an enemy in range of its weapons yet. A unit that charged, for example, may be able to move into reach when it piles in (see [Pile in](#pile-in)).

## Fight order

The phase runs in two steps.

1. **Charging units fight first.** Every unit that made a charge move this turn fights before any other unit. The player whose turn it is picks their charging units one at a time and fights with each.
2. **Then the players alternate.** Once all the charging units have fought, the players take turns picking one eligible unit each. The player whose turn it is **not** picks first. If one player has no eligible units left, the other player fights with all their remaining eligible units, one at a time.

Because the player whose turn it isn't picks first in step 2, a unit that was charged can hit back before any of the attacker's units that didn't charge.

### Fights first and fights last

Some abilities say a unit "fights first" or "fights last". These follow two rules, settled in the June 2021 FAQ:

- Having charged this turn counts as a fights-first ability. A unit with a fights-first ability fights in step 1, alongside charging units.
- Fights-first and fights-last effects **cancel out**. A unit under both kinds of effect, however many of each, fights as if it had neither, in step 2.

> **Not confirmed:** our sources don't say in what order the players pick when both have units that fight first. Check the core rules or agree it with your opponent.

Some effects say a unit "is not eligible to fight until all other units have fought". A fights-first effect cancels that too.

## Fighting with a unit

When you pick a unit to fight, do these three things in order:

1. **Pile in** up to `3"`.
2. **Make close combat attacks.**
3. **Consolidate** up to `3"`.

Finish all three with that unit before anyone picks the next unit.

## Pile in

Piling in lets the models in your unit shuffle into combat before they attack.

- Each model can move up to `3"`. Moving is optional: you can move some, all or none of the models.
- Each model that moves must end **closer to the closest enemy model**.
- A model that is already in base contact with an enemy model can't move, but it counts as having piled in.
- The unit must end the move in [unit coherency](/rules/basics#unit-coherency).

When working out which enemy model is closest, ignore enemy AIRCRAFT unless the moving model can FLY.

[Difficult Ground](/rules/terrain#difficult-ground) doesn't slow pile-in moves.

## Which models fight

Not every model in the unit gets to attack. A model fights if either of these is true:

- it is within Engagement Range of an enemy unit; or
- it is within `½"` of another model from its own unit, and that model is within `½"` of an enemy model.

The second option is the "second rank" rule: a model standing just behind a friend who is touching the enemy can still attack. Models further back than that don't fight.

A model's targets must be enemy units it is fighting against in one of those two ways.

## Making close combat attacks

### Choosing targets

Before you roll any dice, pick the targets for all of the unit's attacks. You can split a unit's attacks between different eligible enemy units.

A unit that **charged** this turn has a limit. It can only attack:

- units it declared a charge against this turn; and
- units that made a [Heroic Intervention](/rules/charge-phase) this turn.

### Choosing weapons

Each model makes a number of attacks equal to its Attacks (A) characteristic.

Say which melee weapon (and which profile, if it has more than one) each model is using before you roll. Resolve all the attacks made with one weapon profile before moving on to the next.

A model that has no melee weapon fights with a **close combat weapon**: its Strength is the model's own Strength, AP 0, Damage 1.

### Rolling the attacks

Close combat attacks use the same steps as [shooting attacks](/rules/shooting-phase):

1. **Hit roll:** roll a D6 for each attack. It hits if the roll equals or beats the model's Weapon Skill (WS). An unmodified 6 always hits and an unmodified 1 always fails.
2. **Wound roll:** compare the weapon's Strength with the target's Toughness to find the roll you need. An unmodified 6 always wounds and an unmodified 1 always fails.
3. **Allocate:** your opponent picks which model in their unit takes the attack. If a model in that unit has already lost wounds, or has already had an attack allocated to it this phase, the attack must go to that model.
4. **Saving throw:** your opponent rolls a D6, modified by the weapon's AP. An unmodified 1 always fails.
5. **Damage:** the model loses wounds equal to the weapon's Damage. Damage left over when the model dies is lost.

Hit rolls and wound rolls can't be changed by more than `+1` or `-1` in total, however many modifiers apply.

### Cover in close combat

Most cover only helps against shooting. [Heavy Cover](/rules/terrain#heavy-cover) is the exception: it adds `+1` to armour saves against melee attacks, but not for a model that made a charge move this turn. A unit that was charged while in [Defensible](/rules/terrain#defensible) terrain may have chosen to Set to Defend, which gives it `+1` to hit in melee.

## Consolidate

After the unit has made its attacks, it consolidates.

- Each model can move up to `3"`. Like piling in, this is optional.
- Each model that moves must end **closer to the closest enemy model**, ignoring enemy AIRCRAFT unless the moving model can FLY.
- The unit must end the move in unit coherency.

A consolidation move can take your unit into Engagement Range of an enemy unit it wasn't fighting before. That enemy unit then becomes eligible to fight this phase, if it hasn't fought already.

## Stratagems in the Fight phase

The core stratagem for this phase is **Counter-offensive** (2 CP). Use it after an enemy unit has fought: pick one of your eligible units, and it fights next, before your opponent can pick another unit.

- It must be an **eligible** unit. A unit under a "not eligible to fight until all other units have fought" effect can't be picked.
- Like any stratagem, you can only use it once per phase. See [How stratagems work](/rules/core-stratagems#once-per-phase).

The full wording is on the [stratagems page](/rules/stratagems).

## Example

Your unit of 10 Intercessors charges an enemy squad and ends with 4 models in Engagement Range.

1. It's your turn and your unit charged, so it fights in step 1.
2. You pile in. Three more Intercessors move up to `3"` each and end within Engagement Range. Two others end within `½"` of a friend who is within `½"` of an enemy model, so they fight from the second rank. The 10th model can't get close enough and doesn't fight.
3. You make the attacks of the 9 models that fight, all against the unit you charged.
4. You consolidate up to `3"`, ending closer to the closest enemy models.

When all your charging units have fought, your opponent picks first in step 2.
