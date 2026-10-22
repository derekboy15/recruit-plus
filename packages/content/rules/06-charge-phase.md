---
id: charge-phase
title: Charge phase
order: 6
summary: How your units charge into close combat, how your opponent can fire Overwatch at them, and how enemy characters can make Heroic Interventions.
sources: [01_Core_Rules/Core_Rules_Turn_Sequence.md §6, 01_Core_Rules/Core_Stratagems.md, 01_Core_Rules/Terrain_Rules.md §3, 01_Core_Rules/Glossary_and_Keywords.md, 05_Balance_Errata_and_Points/FAQs_Errata_and_Rules_Commentary.md]
---
The Charge phase is the fifth phase of your turn. Your units move into close combat with enemy units, ready to fight in the [Fight phase](/rules/fight-phase).

The phase has 2 steps. First you make your charges. Then your opponent can make Heroic Interventions with their CHARACTERS.

## Charging

You charge with your units one at a time. For each unit, you declare its targets, your opponent may fire Overwatch, then you roll and move.

### Which units can charge

One of your units can declare a charge if all of these are true:

- It is within **12"** of at least 1 enemy unit.
- It did not **Advance** or **Fall Back** this turn.
- It is not already within [Engagement Range](/rules/basics#engagement-range) of an enemy unit.

Some units can't charge this turn even if they meet those conditions:

- AIRCRAFT that arrived on the battlefield from reserves this turn.
- Units that disembarked from a TRANSPORT that was destroyed this turn.

### Step 1: Declare targets

Choose 1 or more enemy units within 12" of the charging unit. These are the **targets** of the charge. They don't need to be visible to the charging unit.

### Step 2: Overwatch

Your opponent may now fire [Overwatch](#overwatch) at your unit with one of its targets.

### Step 3: Charge roll

Roll **2D6**. The total, in inches, is the **charge roll**: the furthest each model in the unit can move.

The [Command Re-roll](/rules/stratagems#strat-000002134002) stratagem can re-roll a charge roll, but you must re-roll both dice. You can't keep one die and re-roll the other.

### Step 4: Charge move

The charge only succeeds if you can move the unit so that all of these are true:

- every model moves no further than the charge roll;
- the unit ends within Engagement Range of **every** target you declared;
- the unit ends in [unit coherency](/rules/basics#unit-coherency);
- no model moves within Engagement Range of an enemy unit you didn't declare as a target.

If you can do this, make the move. The unit has now made a **charge move**.

If you can't, the charge **fails** and none of the unit's models move. The unit stays where it is.

### Moving over terrain

- Models can climb over terrain, but they can't move through it unless a terrain trait allows it. Features 1" tall or less can be ignored.
- A model can't end its charge part-way up a climb. If the only way to succeed would leave a model mid-climb, the charge fails.
- Models that can FLY can move over other models when charging, but they still have to climb over terrain, including Buildings, like any other model.
- Charging over Difficult Ground gives -2 to the charge roll.

See [Terrain](/rules/terrain) for every terrain trait, including Defence Lines, which let you charge an enemy on the other side of the feature.

## Overwatch

Overwatch lets a unit being charged shoot at the charging unit before it moves. It isn't free: you normally use the [Fire Overwatch](/rules/stratagems#strat-000002134006) stratagem, which costs 1 CP.

When your opponent declares a charge against one or more of your units:

1. You may use Fire Overwatch. Pick **one** of the units that is a target of that charge.
2. That unit shoots at the charging unit, before the charge roll is made.
3. Each of its attacks only hits on an **unmodified 6**, no matter what its Ballistic Skill is.

Some rules about Overwatch:

- A unit already within Engagement Range of an enemy unit can't fire Overwatch.
- [Look Out, Sir](/rules/shooting-phase#look-out-sir) doesn't protect characters from Overwatch. You can shoot a charging CHARACTER.
- A stratagem can only be used once per phase, so normally only 1 of your units can fire Overwatch in each of your opponent's Charge phases. See [how stratagems work](/rules/core-stratagems).
- Units arriving from Strategic Reserves directly within Engagement Range count as having charged, and can't be shot with Overwatch.
- Some factions can fire Overwatch through their own rules instead of the stratagem. For example, T'AU EMPIRE units have *For the Greater Good*.

### Defensible terrain

If every model of an INFANTRY unit being charged is in Defensible terrain, it can choose one of these when it is charged:

- **Hold Steady:** any Overwatch it fires this phase hits on a 5+ instead of only a 6.
- **Set to Defend:** it can't fire Overwatch, but it gets +1 to hit in melee until the end of the next Fight phase.

Only a target of the charge can use this, and not while it is in Engagement Range. See [Terrain](/rules/terrain).

## After a charge

A unit that made a charge move this turn **fights first** in the Fight phase. See [Fight phase](/rules/fight-phase).

In that Fight phase, a charging unit can only attack units it declared a charge against, or units that made a Heroic Intervention this turn.

A unit whose charge failed didn't make a charge move, so it doesn't fight first.

## Heroic Interventions

Once you have finished all your charges, your opponent can **Heroically Intervene** with their CHARACTERS. This lets a character jump into a nearby fight.

### Which units can intervene

An enemy CHARACTER unit can Heroically Intervene if:

- it is **not** within Engagement Range of any enemy unit; and
- it is within **3" horizontally and 5" vertically** of an enemy unit.

Units that disembarked from a destroyed TRANSPORT this turn can't Heroically Intervene.

### Making the move

Each model in the intervening unit can move up to **3"**. It must end closer to the closest enemy model, and the unit must end in unit coherency. When finding the closest enemy model, ignore AIRCRAFT unless the moving model can FLY.

### Limits

- Each unit can make only 1 Heroic Intervention per enemy Charge phase.
- You never Heroically Intervene in your own Charge phase. It happens only after your opponent's charges.
- Heroic Interventions aren't affected by Difficult Ground.
- A unit that Heroically Intervenes becomes a legal target for the charging units in the Fight phase.

Many codexes give extra units the ability to Heroically Intervene, or let some units do it from further away. Check your codex.

## Example

Your unit of 10 Assault Intercessors is 8" from an enemy unit of Guardsmen and 10" from an enemy tank. Neither is in Engagement Range of your unit, and your unit didn't Advance or Fall Back, so it can charge.

1. You declare a charge against the Guardsmen only. The tank is close by, so your models must not end within Engagement Range of it, because it isn't a target.
2. Your opponent spends 1 CP on Fire Overwatch. The Guardsmen shoot at your unit, and each attack hits only on an unmodified 6. One of your models is destroyed.
3. You roll 2D6 and get a 3 and a 4: a charge roll of 7. Each model can move up to 7".
4. You need to end within Engagement Range of the Guardsmen, which are 8" away. Measured from the closest models, moving 7" brings your front models within 1" of them, so the charge succeeds. You move the unit, keeping it in coherency and away from the tank.

In the Fight phase, your Assault Intercessors fight first, and they can only attack the Guardsmen.

Had you rolled a 5 instead, the charge would fail and your unit would stay where it was.
