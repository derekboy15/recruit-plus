---
id: movement-phase
title: Movement phase
order: 3
summary: How your units move, Advance, Fall Back or stay put, how FLY, AIRCRAFT and transports work, and how reinforcements and Strategic Reserves arrive.
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §3, 01_Core_Rules/Terrain_Rules.md §3, 01_Core_Rules/Glossary_and_Keywords.md §2, 05_Balance_Errata_and_Points/Balance_Dataslates.md §8, 02_Missions_and_Game_Modes/Matched_Play_Overview.md, 01_Core_Rules/Army_Building_Detachments_and_CP.md §7.2]
---
The Movement phase has two steps. First, in the **Move Units** step, you move the units already on the battlefield. Then, in the **Reinforcements** step, you set up units that are arriving from off the battlefield.

## The Move Units step

Pick one of your units, move it, then pick the next. You can pick each unit only once in this phase. When you pick a unit, it does exactly one of these:

| Option | How far | What it costs you |
|---|---|---|
| [Normal Move](#normal-move) | Up to its Move (M) | Can't move within Engagement Range of enemy models. |
| [Advance](#advance) | Up to M plus a D6 roll | Can't move within Engagement Range. Can't charge this turn, and can only shoot Assault weapons. |
| [Fall Back](#fall-back) | Up to M | Must end out of Engagement Range. Can't charge. Can't shoot or manifest psychic powers this turn unless it is TITANIC. |
| [Remain Stationary](#remain-stationary) | Doesn't move | Nothing. Any unit you don't pick counts as Remaining Stationary. |

**Units already in combat.** If a unit starts the Movement phase within [Engagement Range](/rules/basics#engagement-range) of an enemy unit, it can only Fall Back or Remain Stationary. There are two exceptions: AIRCRAFT can always make a Normal Move or Advance, and so can a unit that is only within Engagement Range of enemy AIRCRAFT. The Desperate Breakout Stratagem gives a trapped unit one more option; see [Stratagems](/rules/stratagems).

**Moving models.** When a unit moves, move each of its models up to the distance allowed.

- Measure the move using the part of the model that moves the furthest.
- Models can't move through other models' bases or hulls, unless a rule such as [FLY](#fly) lets them.
- Models can't move off the edge of the battlefield.
- You can turn a model and rotate its turrets freely as part of its move.
- The unit must end its move in [unit coherency](/rules/basics#unit-coherency). If it can't, it can't make that move.

## Normal Move

A Normal Move is the basic way to move. Each model in the unit can move a distance in inches up to its Move characteristic.

During a Normal Move, no model can move within Engagement Range of any enemy model. That means you can't use a Normal Move to get into combat; that is what the Charge phase is for.

After a Normal Move, the unit can still act normally for the rest of the turn: it can manifest psychic powers, shoot and charge.

> **Tip:** Any move that a rule doesn't give a type to counts as a Normal Move. So if an ability says "this unit can move as if it were the Movement phase", it makes a Normal Move. It can't Advance unless the ability says so.

## Advance

An Advance trades firepower for speed.

1. Pick the unit and declare that it will Advance.
2. Roll one D6. This is the unit's **Advance roll**.
3. Each model in the unit can move up to its Move characteristic plus the Advance roll, in inches.

Like a Normal Move, no model can move within Engagement Range of any enemy model during an Advance.

**After Advancing, for the rest of the turn the unit:**

- can't declare a charge;
- can't shoot, except with Assault weapons. Each attack with an Assault weapon after Advancing takes a `-1` penalty to its hit roll;
- can't start an action.

A unit that Advanced can still manifest psychic powers.

You can use the Command Re-roll Stratagem to re-roll an Advance roll; see [Stratagems](/rules/stratagems).

## Fall Back

Falling Back is how a unit gets out of combat. You can only Fall Back with a unit that starts the phase within Engagement Range of an enemy unit.

Each model in the unit can move up to its Move characteristic. Models can move within Engagement Range of enemy models during the move, but every model must **end** the move outside Engagement Range of all enemy models. Models still can't move through enemy models unless they can [FLY](#fly). If the unit can't end its move out of Engagement Range, it can't Fall Back.

**After Falling Back, for the rest of the turn the unit:**

- can't declare a charge;
- can't shoot, unless it is TITANIC;
- can't manifest psychic powers, unless it is TITANIC;
- can't start an action.

When your unit Falls Back, your opponent can use the Cut Them Down Stratagem before it moves, rolling dice to inflict mortal wounds on it. If your unit is surrounded and can't Fall Back normally, you can try the Desperate Breakout Stratagem. Both are on the [Stratagems](/rules/stratagems) page.

## Remain Stationary

A unit that Remains Stationary doesn't move at all this phase. Any of your units that you don't pick in the Move Units step count as having Remained Stationary.

Staying still matters for some rules. The most common one is Heavy weapons: INFANTRY models take a `-1` penalty to hit with Heavy weapons if their unit moved for any reason this turn, including Advancing, Falling Back, disembarking or arriving as reinforcements. A unit that Remained Stationary doesn't take that penalty.

**"Counts as having Remained Stationary."** Some abilities say a unit counts as having Remained Stationary even though it moved. Then:

- if the unit Fell Back but counts as having Remained Stationary, it can shoot;
- it still can't start an action if it Advanced or Fell Back;
- a TRANSPORT that counts as having Remained Stationary after moving still doesn't let units disembark from it, because they must disembark before it moves;
- a unit that disembarked from a transport this turn never counts as having Remained Stationary.

## Moving over terrain

Terrain features change how models move. The Terrain article lists every terrain trait; these are the ones that matter for moving.

- **Low features.** Ignore any part of a terrain feature that is `1"` tall or less. Models move over it as if it weren't there.
- **Climbing.** Models can climb up and down taller features. Count the vertical distance as part of the move. A model can't end its move partway up a climb, so it must reach a level it can stand on.
- **Solid terrain.** Models can't move through solid parts of terrain, such as walls, unless a trait lets them.
- **Breachable.** INFANTRY, BEAST and SWARM models can move through the walls, girders, chains and foliage of a Breachable feature.
- **Scaleable.** Only INFANTRY, BEAST, SWARM and FLY models can end a move on top of a Scaleable Obstacle or on the upper floors of Scaleable Area Terrain. INFANTRY, BEAST and SWARM models can move through its floors and ceilings.
- **Difficult Ground.** If a unit makes a Normal Move, Advance or Fall Back over any part of a Difficult Ground feature, subtract `2"` from the Move characteristic of every model in the unit (to a minimum of 0). This applies even if the feature is `1"` tall or less. It doesn't apply if every model in the unit can FLY, or if every model is TITANIC and the feature is under `3"` tall.

## FLY

Models with the FLY keyword move more freely. When a FLY unit makes a Normal Move, Advance or Fall Back:

- its models can move over other models, friendly or enemy;
- vertical distance doesn't count towards the move, so climbing up and down terrain costs nothing;
- its models still can't **end** the move on top of another model, or within Engagement Range of an enemy model.

A unit where every model can FLY ignores the Difficult Ground penalty. FLY models can also end their moves on the upper floors of Scaleable terrain.

**FLY and charging.** FLY works differently in the Charge phase. A charging FLY model can pass over other models, but it must climb over terrain normally, including Buildings.

**FLY and AIRCRAFT.** FLY models can end a charge within Engagement Range of an enemy AIRCRAFT model, which other units can't do (see [AIRCRAFT](#aircraft)). When FLY models pile in, consolidate or Heroically Intervene, they can treat enemy AIRCRAFT as the closest enemy; other models ignore AIRCRAFT for this.

## AIRCRAFT

AIRCRAFT models have a Move characteristic with a minimum and a maximum, such as `20-60"`. They follow these extra rules.

**Minimum move.** Each time an AIRCRAFT moves, every part of its base must end at least the minimum distance away from where it started. It can move up to the maximum distance as normal. Any modifier to its Move changes both values.

**When it can't move.** If an AIRCRAFT can't make its minimum move, or would have to move off the battlefield, it is destroyed. However, if your army is Battle-forged, it goes into [Strategic Reserves](#strategic-reserves) instead, at no CP cost.

**Flying off on purpose.** If your army is Battle-forged, you can choose to move an AIRCRAFT off any battlefield edge. It goes into Strategic Reserves at no CP cost.

**Arriving.** When an AIRCRAFT arrives from Strategic Reserves, you can set it up anywhere on the battlefield more than `9"` away from all enemy models, facing any direction. It can't charge in the turn it arrives.

**Engagement Range and AIRCRAFT.**

- Other models can move over enemy AIRCRAFT and through their Engagement Range, but can't **end** a move within Engagement Range of an enemy AIRCRAFT. The only exception is a FLY unit ending a charge move.
- AIRCRAFT can make a Normal Move or Advance even while within Engagement Range of enemy units.
- A unit that is only within Engagement Range of enemy AIRCRAFT can move normally.

**Other limits.** AIRCRAFT can't control objective markers and can't perform actions.

**Matched play.** In matched play, the number of AIRCRAFT models you can take is capped by battle size, and every AIRCRAFT must start the battle in Strategic Reserves. See [AIRCRAFT in matched play](/rules/matched-play#aircraft).

> **Tip:** Some AIRCRAFT have bombing abilities that work when they move over enemy units. Since the Arks of Omen Balance Dataslate (January 2023), these only work if the AIRCRAFT is still on the battlefield after its move. Flying off the edge into Strategic Reserves doesn't trigger them, whatever older material says.

## Transports

TRANSPORT models can carry other units. Each one's datasheet gives its **transport capacity**: how many models, and which kinds, it can carry.

### Embarking

If every model in one of your units ends a Normal Move, Advance or Fall Back within `3"` of a friendly TRANSPORT, the unit can embark. Take it off the battlefield and put it to one side.

- A unit can't embark in the same phase it disembarked.
- A move made outside the Movement phase, such as one from an ability, can also be used to embark.
- The TRANSPORT must have room for every model in the unit.

**While embarked,** a unit can't do anything, and no rules or Stratagems can affect it unless they say so. It counts as having made the same kind of move as its TRANSPORT.

### Disembarking

A unit that started the Movement phase embarked can disembark, but only **before** its TRANSPORT moves.

- Set up every model **wholly within** `3"` of the TRANSPORT, and not within Engagement Range of any enemy model.
- If a large model can't fit wholly within `3"`, set it up with its base or hull within `1"` of the TRANSPORT instead.
- The unit counts as having moved, so it never counts as having Remained Stationary this turn.
- Otherwise it acts normally: it can still make a move in this phase, then shoot and charge.

### When a transport is destroyed

When a TRANSPORT is destroyed, resolve any ability it has that triggers on destruction, such as Explodes, first. Then the units inside disembark:

1. Set up each embarked unit wholly within `3"` of the TRANSPORT and not within Engagement Range of any enemy model.
2. Roll one D6 for each model you set up. For each roll of 1, one model in that unit is destroyed. You choose which.
3. Any model that can't physically be set up is destroyed.

These units can't charge or make Heroic Interventions this turn. The Emergency Disembarkation Stratagem lets you set them up further away, at a higher risk; see [Stratagems](/rules/stratagems).

> **Tip:** In the War Zone Nephilim and Arks of Omen matched play mission packs, a Dedicated Transport must start the battle with a unit embarked in it.

## Reinforcements

After the Move Units step comes the **Reinforcements** step. A **reinforcement unit** is any unit that starts the battle somewhere other than on the battlefield, such as a unit that can deep strike or teleport in, or a unit in Strategic Reserves. Set up your reinforcement units one at a time in this step, following the rule that lets them arrive. For example, many deep-striking units arrive anywhere on the battlefield more than `9"` from all enemy models.

**In the turn it arrives,** a reinforcement unit:

- can't make a Normal Move, Advance, Fall Back or Remain Stationary;
- counts as having moved its full Move characteristic. For AIRCRAFT, that is the maximum value. INFANTRY firing Heavy weapons take the `-1` to hit;
- can otherwise act normally: it can manifest psychic powers, shoot, charge and fight.

**Measuring set-up distances.** Distances like "more than `9"` from enemy models" are measured horizontally.

**Transports arriving.** If a TRANSPORT arrives as reinforcements and a unit disembarks from it in the same turn, that unit also counts as a reinforcement unit.

**Never arriving.** Any reinforcement unit that is not on the battlefield when the battle ends counts as destroyed.

### Matched play limits

Matched play missions add these limits to reinforcements and Strategic Reserves:

- No more than half the units in your army, and less than half its points, can start the battle as Strategic Reserves or reinforcement units.
- They can't arrive in battle round 1.
- Any that haven't arrived by the end of battle round 3 count as destroyed. This doesn't apply to a unit that went into reserve after the first battle round started, such as an AIRCRAFT that flew off the battlefield.

## Strategic Reserves

**Strategic Reserves** let any Battle-forged army hold units back and bring them on from a battlefield edge later. Units in Strategic Reserves are reinforcement units, so the rules in [Reinforcements](#reinforcements) apply to them too.

### Putting units into Strategic Reserves

Before the battle, when you declare reserves, you can put units into Strategic Reserves. Add up the Power Rating of all of them, including any units embarked in a TRANSPORT you put there, and pay CP:

| Combined Power Rating | CP cost |
|---|---|
| 1-9 | 1 |
| 10-19 | 2 |
| 20-29 | 3 |
| 30-39 | 4 |
| 40-49 | 5 |
| Each further 10 Power Rating | `+1` CP |

In the Arks of Omen matched play mission pack, putting units into Strategic Reserves costs 0 CP.

Fortifications can never go into Strategic Reserves.

### Arriving from Strategic Reserves

Units in Strategic Reserves can't arrive in battle round 1. From battle round 2, they arrive in the Reinforcements step of your Movement phase:

- **Battle round 2:** set the unit up wholly within `6"` of any battlefield edge except your opponent's, and not within the enemy deployment zone.
- **Battle round 3 onwards:** set the unit up wholly within `6"` of any battlefield edge except your opponent's.
- **Always:** set it up more than `9"` away from all enemy models.

**Arriving at your own edge.** You can ignore the `9"` limit if every model in the unit is set up within `1"` of your own battlefield edge and wholly within your own deployment zone. The unit can even be set up within Engagement Range of enemy units. If it is, it counts as having charged this turn, so it can't be targeted by Overwatch, and it can fight any enemy unit it is within Engagement Range of.

**Very big models.** If a model's smallest dimension is more than `6"`, set it up touching your battlefield edge instead. In the turn it arrives, it can't move, manifest psychic powers, shoot, charge, make a Heroic Intervention or perform actions.

**AIRCRAFT** arriving from Strategic Reserves can be set up anywhere on the battlefield more than `9"` from enemy models; see [AIRCRAFT](#aircraft).
