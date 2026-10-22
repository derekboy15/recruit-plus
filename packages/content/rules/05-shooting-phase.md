---
id: shooting-phase
title: Shooting phase
order: 5
summary: Which of your units can shoot, how to pick targets, what each weapon type does, and how every attack is rolled from hit to damage.
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §5, 01_Core_Rules/Glossary_and_Keywords.md, 01_Core_Rules/Terrain_Rules.md §3.1, 05_Balance_Errata_and_Points/Balance_Dataslates.md, 05_Balance_Errata_and_Points/FAQs_Errata_and_Rules_Commentary.md]
---
The Shooting phase is the fourth phase of your turn. You pick your units one at a time, and each one shoots with its ranged weapons.

The attack sequence explained here (hit, wound, allocate, save, damage) is also used for close combat attacks in the [Fight phase](/rules/fight-phase).

## Who can shoot

Pick one of your units that is eligible to shoot, resolve all of its shooting, then pick the next. A unit can't shoot if:

- it **Advanced** this turn, unless it fires only Assault weapons (see [Weapon types](#weapon-types));
- it **Fell Back** this turn, unless it is TITANIC;
- it is within [Engagement Range](/rules/basics#engagement-range) of an enemy unit. The exceptions are Pistols (see [Weapon types](#weapon-types)) and VEHICLE or MONSTER models (see [Big Guns Never Tire](#big-guns-never-tire)).

Units embarked in a TRANSPORT can't shoot unless the transport's own rules allow it.

## Choosing targets

When you pick a unit to shoot, choose targets for **all** of its weapons before you roll any dice. You can fire any or all of its weapons, and different weapons can shoot at different enemy units. If a weapon has more than one profile (for example a normal shot and a more powerful one), choose the profile now.

Each target must be:

- **In range** of the weapon. Measure from the firing model to the closest part of the target unit.
- **Visible** to the firing model. A model can see a target if you can draw a straight line from any part of the firing model to any part of a model in the target unit. Some terrain blocks sight; see [Terrain](/rules/terrain).

A few more rules limit targets:

- You can't target an enemy unit that is within Engagement Range of any of your units. Pistols and Big Guns Never Tire are the exceptions, and only against enemy units in Engagement Range of the firing unit itself.
- Some weapons have a minimum range as well as a maximum, such as 6"–48". They can't target a unit that is wholly within the shorter distance.
- A CHARACTER may be protected by [Look Out, Sir](#look-out-sir).

### Resolving the attacks

Resolve all the attacks against one target before moving to the next.

To save time, you can roll attacks together ("fast dice") when they have the same Ballistic Skill, Strength, AP, Damage and abilities, and the same target.

## Weapon types

Every ranged weapon has a type, followed by its number of shots. Heavy 2 means a Heavy weapon that makes 2 attacks.

| Type | What it means |
|---|---|
| Assault | The unit can shoot this weapon even if it Advanced this turn, but with -1 to hit. A unit that Advanced can shoot only its Assault weapons. |
| Heavy | If an INFANTRY model fires it and its unit moved this turn for any reason (including arriving as Reinforcements), that attack gets -1 to hit. VEHICLE and MONSTER models only take this -1 when firing it within Engagement Range. |
| Rapid Fire | If the target is within half the weapon's range, the weapon makes double its normal number of attacks. |
| Grenade | Only 1 model in the unit can throw a grenade, and that model doesn't fire any other weapons. |
| Pistol | Can be fired while the unit is within Engagement Range of an enemy, at an enemy unit within Engagement Range of the firing unit. A model fires either its Pistols or its other ranged weapons, never both. |

A unit that **Remained Stationary** fires Heavy weapons without the penalty. Units set up as Reinforcements count as having moved, so their INFANTRY take the Heavy penalty. See [Movement phase](/rules/movement-phase).

## Blast

Blast is a weapon ability. It is printed on the weapon's profile. A Blast weapon fires more shots into big units:

- **Target has between 6 and 10 models:** the weapon always makes at least 3 attacks. If you roll fewer, it makes 3.
- **Target has 11 or more models:** the weapon always makes the maximum number of attacks. For example, a weapon with D6 attacks makes 6, and one with 2D6 attacks makes 12.
- **Target has 5 models or fewer:** roll for the number of attacks as normal.

Some details:

- The minimum of 3 applies to the whole weapon, not to each die. A Blast weapon with 2D3 attacks that rolls two 1s still makes 3 attacks in total, not 3 per die.
- Count the models in the target unit when you choose targets. Models dying during the attack don't change the number.
- A Blast weapon can **never** target a unit that is within Engagement Range of the firing unit. This applies even if it is a Pistol or fired using Big Guns Never Tire.

## Making attacks

Each attack goes through 5 steps.

### 1. Hit roll

Roll a D6. If the result is equal to or higher than the firing model's **Ballistic Skill** (BS), it hits. Some weapons hit automatically and skip this roll.

An unmodified 6 always hits. An unmodified 1 always misses.

### 2. Wound roll

Compare the weapon's **Strength** (S) to the target's **Toughness** (T), then roll a D6.

| Strength compared to Toughness | Roll needed to wound |
|---|---|
| S is double T or more | 2+ |
| S is higher than T | 3+ |
| S equals T | 4+ |
| S is lower than T | 5+ |
| S is half T or less | 6+ |

An unmodified 6 always wounds. An unmodified 1 always fails.

### 3. Allocate the attack

Your opponent picks a model in the target unit to take the attack. It doesn't have to be in range or visible. But if a model in that unit has already lost wounds, or has already had an attack allocated to it this phase, the attack must go to that model.

### 4. Saving throw

Your opponent rolls a D6 and applies the weapon's **AP** (armour piercing) value: AP -1 subtracts 1 from the roll. If the result is equal to or higher than the model's **Save** (Sv), the attack is stopped. An unmodified 1 always fails.

- **Invulnerable saves** ignore AP. A model with one chooses either its normal save or its invulnerable save, never both.
- **Cover** from terrain adds +1 to armour saves but never improves invulnerable saves. See [Terrain](/rules/terrain).

### 5. Inflict damage

If the save fails, the model loses wounds equal to the weapon's **Damage** (D). If the model is destroyed, any extra damage from that attack is lost; it doesn't carry over to another model.

### Limits on modifiers

Add up all the modifiers to a hit roll, from both players. The total can never be more than +1 or less than -1. The same cap applies to wound rolls. Saving throws have no general cap.

## Mortal wounds and ignoring wounds

A **mortal wound** does 1 damage with no wound roll and no saving throw, not even an invulnerable save. Unlike normal damage, extra mortal wounds carry over to the next model when one is destroyed.

Some attacks inflict mortal wounds as well as normal damage. Resolve all the normal damage from the unit's attacks against that target first, then all the mortal wounds. The mortal wounds still happen even if the normal attack was saved.

Some models have a rule like "roll a D6 each time this model would lose a wound; on a 5+ it isn't lost". Players call these **Feel No Pain** rules. They work against mortal wounds too, but a model can use only 1 such rule for each wound.

See [mortal wounds](/rules/glossary) in the glossary.

## Look Out, Sir

Look Out, Sir protects small CHARACTERS from being shot when they stay close to other units.

Your opponent can't target one of your units with ranged attacks if it contains a **CHARACTER with 9 or fewer wounds** (a Wounds characteristic of 9 or less) and it is within **3"** of any of these friendly units:

- a unit containing a VEHICLE or MONSTER model with 10 or more wounds;
- a unit that has no CHARACTER models and contains a VEHICLE or MONSTER model (of any size);
- a unit that has no CHARACTER models and has 3 or more models.

> **Tip:** Any ordinary vehicle or monster protects a nearby character, even a small one like a buggy or a Venom. The 10-wounds limit only matters when the vehicle or monster is itself a CHARACTER: a lone Daemon Prince, for example, can't shield another character. This is the final wording after the 2020 errata.

### When the character can be shot anyway

The character's unit can still be targeted if it is **both** visible to the firing model **and** the closest enemy unit to it. When working out which unit is closest, ignore other enemy units that contain a CHARACTER with 9 or fewer wounds.

Look Out, Sir doesn't apply to Overwatch, so you can shoot a charging CHARACTER (see [Charge phase](/rules/charge-phase#overwatch)).

Some weapons have their own rules that let them target a CHARACTER even when Look Out, Sir would protect it. Players often call these sniper weapons.

### Bodyguard abilities

Some units have a **bodyguard** ability that protects a nearby CHARACTER. Since the 14 Apr 2022 Balance Dataslate, these abilities work the same way as Look Out, Sir. The protected CHARACTER can still be shot if it is visible and the closest target, and weapons that can target a CHARACTER despite Look Out, Sir can target it despite the bodyguard too.

> **Not confirmed:** the April 2022 dataslate exempted the Tyranid Guardian Organism ability when it protects HIVE TYRANT models. Our sources don't say whether the final (13 Apr 2023) dataslate kept that exception.

> **Tip:** Older codexes print some bodyguard abilities as if they protect a character no matter what. Since April 2022 they only protect it the way Look Out, Sir does.

## Big Guns Never Tire

VEHICLE and MONSTER models can shoot even while their unit is within Engagement Range of enemy units.

- They can only target enemy units that are within Engagement Range of their own unit. This is allowed even if other friendly units are also in Engagement Range of that enemy.
- They can also choose targets further away, but those attacks are only resolved if every enemy unit in Engagement Range of the firing unit has been destroyed first.
- Heavy weapons fired this way get -1 to hit while enemies are still within Engagement Range.

Remember that a Blast weapon can never target a unit within Engagement Range of the firing unit, even with Big Guns Never Tire.

## Indirect Fire

Some weapons have rules that let them target units that aren't visible to the firing model. This is called **indirect fire**.

When a weapon like this targets a unit that **isn't visible** to the firing model:

- the firing model's Ballistic Skill is worsened by 1 for those attacks (written -1 BS: a BS of 3+ becomes 4+);
- the target gets **+1** to its armour saving throws against those attacks.

This +1 is not Light Cover, so it adds to any cover the target already has. A target in Light Cover gets +1 from the cover and +1 from this rule.

If the target **is** visible, the weapon fires normally with no penalty.

> **Tip:** This penalty was added by the 14 Apr 2022 Balance Dataslate, so older codexes and articles don't mention it. ASTRA MILITARUM armies were exempt at first, but that exemption ended in January 2023. Every army now takes the penalty.
