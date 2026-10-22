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

## R-19 Manual adjustments, undo and replay
**Decision:**
- Manual adjustments are always allowed, logged and undoable.
- Undo removes the last command, but never reaches back past the start of the current phase or step.
- Replaying a saved game reproduces it exactly, dice included.

**Why:** spec §3.3 (manual toolkit, undo within a phase, saved games) and §5 (event-sourced engine).
