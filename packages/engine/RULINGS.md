# Engine rulings

These are the interpretations the engine makes where the sources are silent, ambiguous or disagree. The sources are listed in the Milestone 4 plan, under "Sources and citation tags". Each ruling gives the decision, why, and the sources. Tests cite them as `[R-n]`.

## R-1 Indirect Fire
**Decision:** a model can fire a weapon that can target units that aren't visible at a unit it can't see. When it does:
- Its Ballistic Skill worsens by 1. This is a characteristic change, so it is not a hit-roll modifier and is not capped at −1.
- The target adds 1 to its armour saving throw for that attack. That bonus is not cover: it stacks with Light Cover, and "ignore cover" rules don't remove it.

**Why:** the research library states it this way (BD §3 for April 2022 and the Jan 2023 removal of the Astra Militarum exemption; TS §5.1). A web summary we found was garbled, so the library wins (spec §4 precedence).

## R-2 Coherency is a single group
**Decision:** a unit is in coherency when both of these hold:
- every model has one other model (two if the unit has 6+ models) within 2" horizontally and 5" vertically;
- all its models form one connected group.

**Why:** Wahapedia's final core rules text says a unit "must be set up and finish any sort of move as a single group". TS §1.2 gives the neighbour counts.

## R-3 Line of sight on a 2D footprint model
**Decision:** a model can see another unless every straight line between them passes through the footprint of an Obscuring feature that is at least 5" tall. "Every line" is tested between the centre and 16 points around each base. Three exceptions:
- the feature doesn't block a model that has any part of its base within that feature, whether it is the observer or the target;
- AIRCRAFT targets and targets with W 18+ are never blocked;
- models never block line of sight.

**Why:** spec §9 chose a 2D footprint-based Obscuring/Dense model. TR §3.3 and §3.4 cover Obscuring, "see out" (Aug 2020), and Aircraft/W18+.

## R-4 Dense Cover test
**Decision:** a ranged attack takes −1 to hit when a Dense feature at least 3" tall lies across every line from any single sample point of the firer to all sample points of every target model. The −1 doesn't apply in these cases:
- the firer is within that area feature;
- the firer is within 3" of that obstacle;
- the target unit is AIRCRAFT or has a W18+ model.

**Why:** TR §3.1, using R-3's sampling.

## R-5 Climbing over terrain
**Decision:** vertical distance counts toward a move: |end elevation − start elevation|. A feature taller than 1" that the model can't pass through adds twice its height in two cases:
- the path crosses right over it;
- the path starts or ends inside it at ground level.

Features 1" tall or less, and hills, cost nothing. INFANTRY, BEAST and SWARM pass through Breachable features. FLY models ignore vertical distance on a Normal Move, Advance or Fall Back, but not when charging.
**Why:** TR §1 ("taller features can be climbed; vertical distance counts"), TR §3.2, TS §3.1 and GL §2. A 2D board has no walls, so a feature is treated as a block of its height.

## R-6 Defence Line
**Decision:** two models within 2" horizontally, whose centre line crosses a Defence Line feature, count as within Engagement Range of each other for charging and fighting.
**Why:** TR §3.3: units on opposite sides within 2" can be charged and fight across it.

## R-7 Invulnerable saves from datasheet text
**Decision:** a model gets an invulnerable save from its abilities only when a whole sentence states it unconditionally, for example "This model has a 4+ invulnerable save." or "Models in this unit have a 5+ invulnerable save.". A sentence that has any of these words doesn't count: against, while, whilst, if, bearer, equipped, contains, round, unless, until, instead. Every other invulnerable save is applied with the one-tap invulnerable effect.
**Why:** about 1,870 unconditional cases read safely. The roughly 1,240 conditional ones (ranged-only, equipment-dependent and so on) can't be applied correctly without per-faction code, which the spec rules out (§3.3).

## R-8 Base sizes the data doesn't give
**Decision:** "Use model" and missing bases get an estimated footprint, flagged `baseEstimated`:
- TITANIC: a 5"×9" hull;
- other VEHICLE: a 3"×5" hull;
- MONSTER: a 60mm circle;
- anything else: a 32mm circle.

**Why:** TS §1.4 measures to the hull for baseless models; the data has no hull sizes. Milestone 5 can refine them.

## R-9 Knights on objectives
**Decision:** in the Imperial Knights and Chaos Knights catalogues, each model counts as more than one model for objective control:
- TITANIC VEHICLE models count as 10;
- ARMIGER and WAR DOG models (and Moiraxes) count as 5, matched by name where the data has no keywords.

**Why:** BD §2 (9 Nov 2021 dataslate, carried over in later slates).

## R-10 Transport capacity
**Decision:** the capacity is the model count in the Capacity text. Keyword restrictions and "takes the space of" rules are assisted, not enforced.
**Why:** that text is free-form per datasheet; spec §3.3 keeps datasheet text assisted.

## R-11 Weapon types without a core rule
**Decision:** a weapon type other than Assault, Heavy, Rapid Fire, Grenade, Pistol, Melee and Dakka (e.g. HunTR) is read as `Other`. It has no type rule: no penalty, no restriction and no extra shots.
**Why:** those types are defined by faction rules (assisted).

## R-12 Dakka weapons
**Decision:** a Dakka X/Y weapon makes X attacks against a target within half range and Y otherwise. A unit that Advanced can't fire it unless the toolkit allows it (the faction rule is assisted).
**Why:** the X/Y numbers are on the profile; the rule for Dakka after Advancing is codex text.

## R-13 One model, one objective
**Decision:** a model within range of more than one objective marker counts only toward the nearest one. On a tie it counts toward the marker listed first in the mission.
**Why:** TS §9: "each model counts toward only one marker per turn". The core rules don't say which marker it counts toward, and nearest is the natural reading on a digital board.

## R-14 Allocating attacks in advance
**Decision:** the defender's choice of which model receives each attack is set in advance as the unit's casualty order. The owner can change it at any time with the toolkit. By default the order is the reverse of the unit's model list, so sergeants and special models go last. The core rule is always applied: if any model in the unit has lost wounds or has had an attack allocated this phase, the attack goes to that model.
**Why:** TS §5.6. Allocation happens before each saving throw, so choosing ahead gives the same outcomes as choosing each time. It lets saves be rolled together ("fast dice", TS §5.1), and the sandbox stays playable with one device.

## R-15 The defender takes the better save
**Decision:** the engine uses whichever of the model's armour save (after AP, cover and modifiers) and invulnerable save needs the lower roll.
**Why:** TS §5.7: the player chooses one save. The better one is always the right choice, and it saves a prompt for every attack.

## R-16 One profile per weapon
**Decision:** a weapon with several profiles fires only one of them each time the unit shoots, for example "Plasma gun - standard" and "Plasma gun - supercharge". Profiles count as the same weapon when their names match up to the first " - ", "(", "[" or ",".
**Why:** TS §5.1: you choose the weapon's profile when selecting targets.

## R-18 Fight order
**Decision:** each unit eligible to fight is in one of three tiers:
- **first:** it charged this turn or has a fights-first effect, and no fights-last effect;
- **last:** it has a fights-last effect and no fights-first effect;
- **normal:** everything else, including units with both effects.

The players then pick units to fight:
- They alternate, starting with the player whose turn it isn't. When the player due to pick has no unit they can pick, the other player picks.
- While any first-tier unit (on either side) still has to fight, only first-tier units can be picked.
- A player's last-tier units can be picked only when that player has no other eligible units left.
- Counter-offensive makes the chosen unit fight next. After it fights, the alternation carries on from the other player.

**Why:** WCR: "starting with the player whose turn is not taking place, the players must alternate selecting an eligible unit", and non-chargers "cannot be selected to fight until after all units that did make a charge move have fought". This is Wahapedia's final FAQ'd text, which outranks forum memories that the active player picks first among fights-first units (the 2020 launch wording had separate steps). We couldn't read the June 2021 Rare Rule PDF itself. If it turns out the active player starts the fights-first step, the fix is one line in `fightOrder`. TS §7.1 and §7.2: charging counts as fights first, and fights-first and fights-last cancel out. CS §2 covers Counter-offensive.

## R-27 Assigning melee attacks
**Decision:** a fighting model that makes attacks must use exactly its Attacks characteristic (plus extra-attacks effects), split between its melee weapons. A model with no melee weapon uses the close combat weapon. A model with a random Attacks characteristic is not count-checked; its owner enters the rolled number.
**Why:** TS §7.3. Random A values are rare (degraded vehicles), and a roll window for each model's Attacks would add little.

## R-24 Mixed Toughness
**Decision:** wound rolls against a unit whose models have different Toughness use the Toughness most of its models have. On a tie, the higher value is used (the defender's choice).
**Why:** the 9th Edition "mixed unit" rule, as quoted in community sources (the library doesn't cover it): "use the Toughness of the majority … in a tie the controlling player picks".

## R-25 Look Out, Sir protectors
**Decision:** a unit with a CHARACTER of W 9 or less is protected while within 3" of any of these friendly units:
- a unit with a VEHICLE or MONSTER of W 10 or more;
- a non-CHARACTER unit with any VEHICLE or MONSTER;
- a non-CHARACTER unit of 3 or more models.

It can still be shot if it is visible to the firing model and is the closest enemy unit to it. Other protected character units are ignored when working out which unit is closest.
**Why:** the research library disagrees with itself. TS §5.3 lists all three protectors, while FAQ §2.1 says small vehicle units need 10+ wounds. Wahapedia's final Core Rules text lists all three, and the 10+ wounds clause applies only to the first one. Wahapedia's final text wins (spec §4 precedence: later GW text over the library).

## R-17 Hold Steady
**Decision:** a unit that Holds Steady fires Overwatch that hits on an unmodified 5+, using the Fire Overwatch stratagem as usual (1 CP, once per phase).
**Why:** TR §3.3 says Hold Steady Overwatch "hits on 5+". CS §2 notes it is ambiguous whether that means an unmodified 5+. Overwatch's normal requirement is an unmodified 6, so we read it the same way.

## R-26 Which weapons fire Overwatch
**Decision:** a unit firing Overwatch shoots, from every model that can see the charging unit, every ranged weapon in range. Pistols fire only if the model has no other weapon that can shoot, and grenades never do. Only one profile of each weapon fires. Each charge allows one reaction from the targets: Overwatch, Hold Steady (Overwatch at 5+) or Set to Defend.
**Why:** CS §2 makes one target unit fire Overwatch, and there is no reason to hold weapons back. Choosing the weapons automatically keeps the reaction to one tap in pass-and-play.

## R-20 Mustering a saved list
**Decision:** a list's units are matched to their datasheets by BattleScribe id; each copy of a duplicated unit becomes its own unit. Names are then matched like this:
- **Models:** a model entry uses the model profile with the same name. Failing that, it uses the profile named like the entry without a trailing "(loadout)", then the longest profile name it starts with. A datasheet with a single profile always uses it.
- **Weapons:** a weapon entry (and the unit's own wargear, which every model gets) gives the weapon profiles with the same name, or with that name followed by " -", ",", " (" or " [". Combined entries such as "Bolt Pistol & Boltgun", "X w/ Y" and "2x Entropy cannon", and plurals, are split up first.

Anything that still doesn't match is reported to the player and never guessed. The counts are pinned by `test/data/muster-baseline.json`.
**Why:** the generated unit JSON has no link from wargear entries to weapon profiles, so names are all there is. A wrong weapon is worse than a reported missing one (spec §2 anti-goals).

## R-21 Daemonic Save
**Decision:** a LEGIONES DAEMONICA model whose Save reads "5+/4+" has a Daemonic Save and no armour save. The first value is used against melee attacks and the second against ranged attacks. The roll is never modified (no AP, no cover, no modifiers), and an unmodified 1 still fails.
**Why:** the datasheets' "Daemonic Invulnerability" ability text in the BSData v9.8.0 data: "The first characteristic is used when a melee attack is allocated to that model, while the second … ranged … the saving throw cannot be modified in any way."

## R-22 Aircraft and the reserve limits
**Decision:** AIRCRAFT units start in Strategic Reserves automatically and cost no CP. They don't count toward the "no more than half the units, less than half the points" limit. If they are more than half the army's points, no other unit may start in reserve.
**Why:**
- BD §6 (Jan 2023): Aircraft must start in Strategic Reserves.
- MP §3: "If they make up more than half the army's points, no other unit may be in reserve". That only makes sense if they are outside the normal limit.
- In Arks of Omen games Strategic Reserves are free anyway. For Core Book games, charging CP for a placement the rules force is not stated anywhere.

## R-23 Aircraft that leave the battlefield
**Decision:** an Aircraft that flies off the battlefield into Strategic Reserves can arrive again from the next turn. The reserves deadline ("not arrived by the end of battle round 3, destroyed") doesn't apply to it: it already arrived once.
**Why:** TS §3.5 lets Aircraft go into Strategic Reserves "for free and return next turn". The deadline (TS §3.2, MP §4) is about Reinforcements that never arrived.

## R-19 Manual adjustments, undo and replay
**Decision:**
- Manual adjustments are always allowed, logged and undoable.
- Undo removes the last command, but never reaches back past the start of the current phase or step.
- Replaying a saved game reproduces it exactly, dice included.

**Why:** spec §3.3 (manual toolkit, undo within a phase, saved games) and §5 (event-sourced engine).
