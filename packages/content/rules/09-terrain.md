---
id: terrain
title: Terrain
order: 9
summary: Each terrain feature has a category that decides who can use it for cover and traits that decide what it does, from Light Cover to Obscuring.
sources: [01_Core_Rules/Terrain_Rules.md, 01_Core_Rules/Core_Rules_Turn_Sequence.md §3.1, 01_Core_Rules/Glossary_and_Keywords.md §2, 01_Core_Rules/Core_Stratagems.md §2, 05_Balance_Errata_and_Points/FAQs_Errata_and_Rules_Commentary.md §2.1]
---
Terrain in 9th edition works in two layers. A feature's **category** decides which models can use it and how. Its **traits** decide what it actually does: give cover, block sight, slow movement and so on.

## Categories and traits

Every terrain feature belongs to exactly **one category**: Hills, Obstacles, Area Terrain or Buildings. The category answers "who can get cover from this, and how close do they need to be?"

A feature then has any number of **traits**, such as Light Cover, Obscuring or Breachable. The traits answer "what does this feature do?" A feature with no cover traits gives no cover at all, even to a model standing right inside it.

Before the game, you and your opponent agree the category and traits of every piece of terrain. Tournament mission packs and organisers usually decide this in advance. For Area Terrain, also agree its **footprint**: the outline on the ground that counts as "within" the feature.

Terrain features can't be attacked. Buildings are the exception, because they are units (see [Terrain categories](#terrain-categories)).

## Terrain categories

| Category | Examples | Who gets cover from it |
|---|---|---|
| **Hills** | Free-standing hills, or hills built into the board | Nobody. A hill is part of the battlefield, not a terrain feature. |
| **Obstacles** | Barricades, ruined walls, armoured containers, statues, battlefield debris | INFANTRY, BEAST and SWARM models within `3"` of it, unless the attacker has a clear view of the whole model (see below) |
| **Area Terrain** | Ruins, woods, craters, industrial structures | INFANTRY, BEAST and SWARM models within its footprint |
| **Buildings** | Fortifications with the BUILDING keyword | Whatever the building's datasheet says |

### Hills

Models move over hills and see across them normally. Because a hill isn't a terrain feature, a model on a hill doesn't count as being on terrain, so abilities that work "while on a terrain feature" don't work there.

### Obstacles

An INFANTRY, BEAST or SWARM model within `3"` of an Obstacle gets that Obstacle's cover benefits. The exception: if the attacking model can draw 1mm-wide straight lines from one point on its base (or hull) to **every part** of the target model's base without any line crossing the Obstacle, the target doesn't get cover from it.

Cover is checked model by model, so some models in a unit can be in cover while others aren't.

### Area Terrain

An INFANTRY, BEAST or SWARM model that is on or within the footprint of an Area Terrain feature gets that feature's cover benefits. There is no line-drawing test.

A unit can have some models inside the footprint and some outside. Only the models inside get cover. Remember that once an attack has been allocated to a model in the unit, the following attacks must go to that same model.

### Buildings

A Building is a **unit**, not a terrain feature. It belongs to one player, can be attacked, and can't be moved through. Models see past it using normal visibility. Its datasheet says what it does.

### Vehicles, monsters and other models

Models that aren't INFANTRY, BEAST or SWARM, such as VEHICLE, MONSTER, BIKER and CAVALRY models, can't get cover from Obstacles or Area Terrain through these category rules. [Dense Cover](#dense-cover) is different: it helps any model that is behind it.

## Moving over terrain

These rules apply to every category.

- Models can move **over** terrain but not **through** it, unless a trait such as [Breachable](#breachable) or [Scaleable](#scaleable) lets them.
- Features `1"` tall or less are ignored for movement.
- Models can climb taller features. Count the vertical distance moved as part of the move.
- A model can't end its move partway up a climb.
- FLY models ignore vertical distance when they make a Normal Move, Advance or Fall Back. When they **charge**, they must climb terrain like any other model.

## Terrain traits at a glance

| Trait | What it does |
|---|---|
| **Light Cover** | `+1` to armour saves against ranged attacks for models getting cover from it. |
| **Heavy Cover** | `+1` to armour saves against melee attacks for models getting cover from it, unless the model made a charge move this turn. |
| **Dense Cover** | If at least `3"` tall, ranged attacks through it take `-1` to hit. |
| **Exposed Position** | Models on top of it get no cover. |
| **Breachable** | INFANTRY, BEAST and SWARM can move through its walls. |
| **Scaleable** | Only INFANTRY, BEAST, SWARM and FLY models can end a move on top of it or on its upper floors. |
| **Difficult Ground** | `-2"` to Move characteristics when moving over it, and `-2` to charge rolls. |
| **Unstable Position** | Models can't end a move or be set up on top of it. |
| **Obscuring** | If at least `5"` tall, models can't see through or over it. |
| **Defensible** | INFANTRY units in or behind it can Hold Steady or Set to Defend when charged. |
| **Defence Line** | Units on opposite sides of it can charge and fight across it from within `2"`. |
| **Inspiring** | Units wholly within `6"` get `+1` Ld. |

Each trait is explained in full below.

## Cover traits

These traits decide what "getting cover" from a feature actually gives a model. Remember that the feature's [category](#terrain-categories) decides which models get cover from it in the first place.

### Light Cover

Against **ranged** attacks, a model getting cover from this feature adds `+1` to its armour saving throws.

Light Cover never improves an invulnerable save. It does stack with the [Indirect Fire](/rules/shooting-phase#indirect-fire) bonus, which isn't cover.

### Heavy Cover

Against **melee** attacks, a model getting cover from this feature adds `+1` to its armour saving throws. This doesn't apply if the model the attack is allocated to **made a charge move this turn**.

In practice, a unit sitting in Heavy Cover is protected against the enemy that charges it, but a unit that charges into Heavy Cover gets no benefit. This is the rule as corrected in August 2020; the first printing of the Core Book had it the other way round.

Heavy Cover never improves an invulnerable save.

### Dense Cover

Dense Cover only works if the feature is at least `3"` tall. When a model makes a **ranged** attack, subtract 1 from the hit roll (`-1` to hit) unless the attacker can draw 1mm-wide straight lines from one point on its base (or hull) to **every part** of the base of at least one model in the target unit, without any line crossing a Dense Cover feature.

- Dense Cover works whenever the feature is between the attacker and the target. It doesn't matter what keywords the target has or whether it is getting cover from the feature, so VEHICLE and MONSTER units benefit too.
- An attacker that is on or within a Dense Cover Area Terrain feature ignores that feature. An attacker within `3"` of a Dense Cover Obstacle ignores that Obstacle.
- There is no penalty when attacking an AIRCRAFT unit, or a unit containing a model with a Wounds characteristic of 18 or more.
- Rules that ignore cover, or ignore hit penalties from cover, ignore Dense Cover.

### Exposed Position

A model standing **on top of** this feature never gets the benefits of cover. Models behind it can still get cover from it as normal.

## Movement traits

### Breachable

INFANTRY, BEAST and SWARM models can move through this feature's walls, girders, chains and foliage as if they weren't there. Other models must go over or around them.

### Scaleable

Only INFANTRY, BEAST, SWARM and FLY models can be set up on top of a Scaleable Obstacle, end a move on top of it, or be set up or end a move on the **upper floors** of Scaleable Area Terrain. Other models can still use the ground floor.

INFANTRY, BEAST and SWARM models can move through this feature's floors, ceilings and gantries as if they weren't there.

### Difficult Ground

When a unit makes a Normal Move, Advance or Fall Back, and any of its models will move over any part of this feature, subtract `2"` from the Move characteristic of **every model in the unit**. The Move characteristic can't go below 0.

When a unit charges over any part of this feature, subtract 2 from its charge roll (`-2`).

- Difficult Ground applies even if the feature is `1"` tall or less.
- It doesn't apply if **every model in the unit can FLY**.
- It doesn't apply if **every model in the unit is TITANIC** and the feature is less than `3"` tall.
- It doesn't affect pile-in moves, consolidation moves or Heroic Interventions.

Because Difficult Ground changes the Move characteristic, rules that let a unit ignore penalties to its Move characteristic work against it.

### Unstable Position

Models can't be set up on top of this feature and can't end a move on top of it. They can still move over it.

## Interactive traits

### Obscuring

Obscuring only works if the feature is at least `5"` tall. Models can't see **through or over** it: if every straight 1mm line from the observer to the target would pass through or over any part of the feature, the target isn't visible. This applies even if there are windows or gaps in the feature.

- Models **on or within** an Obscuring feature can see out of it and be seen as normal.
- AIRCRAFT models, and models with a Wounds characteristic of 18 or more, can still be seen and targeted through Obscuring terrain. They can't see through it themselves.
- Obscuring adds to normal line of sight; it doesn't replace it. Even an AIRCRAFT model or an 18-wound model can only be targeted if the attacker can physically see it. A solid wall still blocks sight.

### Defensible

This trait helps an INFANTRY unit that is charged. The unit can use it if **every model** in the unit is either:

- on or within a Defensible Area Terrain feature; or
- within `3"` of a Defensible Obstacle, placed so that a line between the closest models of the two units crosses the Obstacle.

When an enemy unit declares a charge against that unit, choose one of these:

- **Hold Steady:** any Overwatch your unit fires this phase hits on a `5+` instead of only on 6s.
- **Set to Defend:** your unit can't fire Overwatch, but it gets `+1` to hit with melee attacks until the end of the next Fight phase.

Your unit can't use this trait if it is already within Engagement Range of an enemy unit. Only the unit being charged can use it, not other units joining in with its Overwatch.

> **Not confirmed:** the rules don't say clearly whether Hold Steady's `5+` is an unmodified roll. A common reading is that it is. Agree it with your opponent before the game.

Overwatch itself is a stratagem; see the [Charge phase](/rules/charge-phase) and the [stratagems page](/rules/stratagems).

### Defence Line

A unit on the other side of a Defence Line can be hard to reach, so this trait loosens the usual distances.

- An enemy unit within `1"` of this feature can still be charged, as long as the charging models end touching the feature and within `2"` of the target.
- Units on opposite sides of this feature that are within `2"` of each other can fight and attack each other across it.

The "second rank" `½"` rule for which models fight doesn't change. See [Which models fight](/rules/fight-phase#which-models-fight).

### Inspiring

Units **wholly within** `6"` of this feature get `+1` to their Leadership characteristic. If the trait lists keywords in brackets, such as Inspiring (IMPERIUM), only units with those keywords benefit. Leadership matters most in the [Morale phase](/rules/morale-phase#morale-tests).

## Who gets cover from what

This table sums up how each kind of model is affected by the four main ways terrain protects it.

| Model type | Area Terrain (model within it) | Obstacle (model within `3"`, line test) | Dense Cover (between attacker and target) | Obscuring (at least `5"` tall) |
|---|---|---|---|---|
| INFANTRY / BEAST / SWARM | Yes (the feature's traits apply) | Yes | Yes (`-1` to hit) | Hidden if fully behind it |
| VEHICLE / MONSTER (Wounds under 18) | No (category rule) | No | Yes (`-1` to hit) | Hidden if fully behind it |
| Models with Wounds 18 or more | No | No | **No** penalty for attackers | **Not** hidden (attacker still needs true line of sight) |
| AIRCRAFT | No | No | **No** penalty for attackers | **Not** hidden (attacker still needs true line of sight) |

Other models that aren't INFANTRY, BEAST or SWARM, such as BIKER or CAVALRY models, also get no cover from Area Terrain or Obstacles under the category rules.

## Common terrain features

The Core Book suggests these categories and traits for common kinds of terrain. Use them unless you and your opponent, or your tournament, agree otherwise.

| Feature | Category | Traits |
|---|---|---|
| **Ruins** | Area Terrain | Scaleable, Breachable, Light Cover, Defensible, Obscuring |
| **Craters** | Area Terrain | Light Cover, Difficult Ground |
| **Woods** | Area Terrain | Dense Cover, Breachable, Defensible, Difficult Ground |
| **Industrial Structure** | Area Terrain | Scaleable, Breachable, Dense Cover, Defensible |
| **Armoured Containers** | Obstacle | Light Cover, Scaleable, Exposed Position |
| **Barricades and Fuel Pipes** | Obstacle | Defence Line, Light Cover, Heavy Cover, Defensible, Unstable Position, Difficult Ground |
| **Battlefield Debris** | Obstacle | Exposed Position |
| **Imperial Statuary** | Obstacle | Light Cover, Unstable Position, Inspiring (IMPERIUM) |
| **Ruined Walls** | Obstacle | Defence Line, Breachable, Dense Cover, Defensible, Unstable Position |

Notice that Ruins don't have Dense Cover, and Woods and Industrial Structures don't have Light Cover.

## Setting up the battlefield

The minimum battlefield sizes are:

- `44" x 30"` for Combat Patrol and Incursion games;
- `44" x 60"` for Strike Force games;
- `44" x 90"` for Onslaught games.

The Core Book recommends about one terrain feature for every `12" x 12"` area of the battlefield, rounding up. Spread a mix of Obstacles and Area Terrain across the table, and put some Obscuring pieces near the centre so no unit can see from one end of the table to the other.

- Fortifications can't be set up within `3"` of any other terrain feature, though hills don't count.
- In the Grand Tournament mission packs, terrain can't be placed on top of objective markers.
