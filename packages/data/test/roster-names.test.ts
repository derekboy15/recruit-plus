/**
 * optionDisplay rules, from the survey of 17,550 option names in test/fixtures/option-prefixes.json
 * (scripts/option-prefixes.ts). Every prefix with 5 or more uses:
 * - "Stratagem" (974) and its misspelling "Strategem" (42): heading "Stratagem"; a generic rest is sentence-cased
 *   ("Stratagem: Warlord Trait" -> "Warlord trait").
 * - "Relic" (120), "Relic (X)": heading "Relic", "Relic · X". "Heirloom" (30, Imperial Knights' Heirlooms of the
 *   Household, which are relics): heading "Relic" too.
 * - "Warlord Trait" (56), "Warlord Trait (X)" and the abbreviation "WT" (16): heading "Warlord trait", "Warlord trait · X".
 *   A qualifier's trailing number goes ("Codex 2", "Metalica 1" -> "Codex", "Metalica"); "BRB" is the Core Book.
 * - "Arkana" (36, Necrons): heading "Cryptek Arkana", the group BSData puts them in.
 * - "Power" (9): heading "Psychic power".
 * - The faction's own lists keep their name as the heading: "Chapter Command", "Martial Tradition", "Custom Household",
 *   "Dynastic Tradition", "Exalted Court", "Order", "Power of the C'tan", "Dynasty", "Leviathan", "Forge World",
 *   "Circumstance of Awakening", "Knightly Teaching", "Fractured Personality", "Oath", "Vassal Kingdom", "Custom".
 * - A roll number ("2: Walker of Many Paths", "Warlord Trait: 6. Pure of Will", "4 - Painbringer") is dropped.
 * - A bare "(Sept): " prefix (T'au, 5+ for Vior'la) is the heading: "(Vior'la): Academy Luminary" -> "Vior'la".
 * - BattleScribe's "!" sort mark and "[Reference] " are dropped; "[Legends]", "[LEGENDS]", "(Legends)" set `legends`.
 * - "<Custom>" placeholders read "Custom <prefix, lower-cased>": "Dynasty: <Custom>" -> "Custom dynasty".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { displayName, optionDisplay } from '../src/roster';

const fixture: { prefixes: { key: string; count: number; examples: string[] }[] } = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'option-prefixes.json'), 'utf8'),
);

test('displayName drops BattleScribe "*…*" and "-…-" decoration', () => {
  expect(displayName('-Dynastic Code-')).toBe('Dynastic Code');
  expect(displayName('*Far-Flung Craftworld*')).toBe('Far-Flung Craftworld');
  expect(displayName('**Chapter Selector**')).toBe('Chapter Selector');
  expect(displayName('* No Psychic Power Selected *')).toBe('No Psychic Power Selected');
  expect(displayName('*Random x 2* (Combat Drug)')).toBe('Random x 2 (Combat Drug)');
  expect(displayName('Faction: *Custom Kabal*')).toBe('Faction: Custom Kabal');
  // Hyphens inside a name are kept.
  expect(displayName(' Hive Fleet: Hyper-adaption ')).toBe('Hive Fleet: Hyper-adaption');
  // Nothing left: the name as written.
  expect(displayName('-')).toBe('-');
});

const plain = (name: string, heading: string | null = null) => ({ name, heading, legends: false });

test.each([
  ['Warlord Trait (Novokh): Blood-Fuelled Fury', { name: 'Blood-Fuelled Fury', heading: 'Warlord trait · Novokh', legends: false }],
  ['Warlord Trait (Codex 2): Eternal Madness', { name: 'Eternal Madness', heading: 'Warlord trait · Codex', legends: false }],
  ['Relic (Szarekhan): The Sovereign Coronal', { name: 'The Sovereign Coronal', heading: 'Relic · Szarekhan', legends: false }],
  ['Dynasty: Novokh', { name: 'Novokh', heading: 'Dynasty', legends: false }],
  ['Dynasty: <Custom>', { name: 'Custom dynasty', heading: 'Dynasty', legends: false }],
  ['Stratagem: Warlord Trait', { name: 'Warlord trait', heading: 'Stratagem', legends: false }],
  ['Stratagem: Relic', { name: 'Relic', heading: 'Stratagem', legends: false }],
  ['Stratagem: Dynastic Heirlooms', { name: 'Dynastic Heirlooms', heading: 'Stratagem', legends: false }],
  ['Renegades & Heretics [LEGENDS]', { name: 'Renegades & Heretics', heading: null, legends: true }],
  ['Gauss Blaster', { name: 'Gauss Blaster', heading: null, legends: false }],
  ['**Chapter Selection**', { name: 'Chapter Selection', heading: null, legends: false }],
  // One per surveyed prefix with 5+ uses.
  ['Stratagem: Heroic Support', plain('Heroic Support', 'Stratagem')],
  ['Strategem: Lucifer-Pattern Engines', plain('Lucifer-Pattern Engines', 'Stratagem')],
  ['Relic: Book of St. Lucius', plain('Book of St. Lucius', 'Relic')],
  ['Warlord Trait: 6. Pure of Will', plain('Pure of Will', 'Warlord trait')],
  ['Warlord Trait: 5. Indomitable Belief (Aura)', plain('Indomitable Belief (Aura)', 'Warlord trait')],
  ['Chapter Command:  Chief Librarian', plain('Chief Librarian', 'Chapter Command')],
  ['Arkana: Atavindicator', plain('Atavindicator', 'Cryptek Arkana')],
  ['Martial Tradition: Mythic Hero', plain('Mythic Hero', 'Martial Tradition')],
  ['Heirloom: The Helm Dominatus', plain('The Helm Dominatus', 'Relic')],
  ['Heirloom (Cadmus): The Hunter\'s Eye', plain('The Hunter\'s Eye', 'Relic · Cadmus')],
  ['Custom Household: Front-Line Fighters', plain('Front-Line Fighters', 'Custom Household')],
  ['Dynastic Tradition: Eternal Conquerors', plain('Eternal Conquerors', 'Dynastic Tradition')],
  ['Exalted Court: High Monarch', plain('High Monarch', 'Exalted Court')],
  ['Order: Sacred Rose', plain('Sacred Rose', 'Order')],
  ["Power of the C'tan: Gaze of Death", plain('Gaze of Death', "Power of the C'tan")],
  ['Leviathan: Gestalt Commander', plain('Gestalt Commander', 'Leviathan')],
  ['WT: Old Grudges', plain('Old Grudges', 'Warlord trait')],
  ['WT (Militarum Tempestus): Drill Commander (Aura)', plain('Drill Commander (Aura)', 'Warlord trait · Militarum Tempestus')],
  ['Forge World: Lucius', plain('Lucius', 'Forge World')],
  ['Forge World: <Mixed>', plain('Mixed forge world', 'Forge World')],
  ['Circumstance of Awakening: The Ancients Stir', plain('The Ancients Stir', 'Circumstance of Awakening')],
  ['Knightly Teaching: The Virtue of Courage', plain('The Virtue of Courage', 'Knightly Teaching')],
  ['Fractured Personality: Entropic Touch', plain('Entropic Touch', 'Fractured Personality')],
  ['Oath: Refuse No Challenge', plain('Refuse No Challenge', 'Oath')],
  ['Vassal Kingdom: Novokh', plain('Novokh', 'Vassal Kingdom')],
  ['Custom: Rad-saturated Forge World', plain('Rad-saturated Forge World', 'Custom')],
  ['Relic (Metalica): Delta Pistol', plain('Delta Pistol', 'Relic · Metalica')],
  ['Power: Smite', plain('Smite', 'Psychic power')],
  ['2: Walker of Many Paths', plain('Walker of Many Paths')],
  ['4 - Painbringer (Combat Drug)', plain('Painbringer (Combat Drug)')],
  ['1. Calculating Gaze (Aura)', plain('Calculating Gaze (Aura)')],
  ['Warlord Trait (Metalica 1): Master Annihilator', plain('Master Annihilator', 'Warlord trait · Metalica')],
  ['Warlord Trait (BRB 2): Inspiring Leader', plain('Inspiring Leader', 'Warlord trait · Core Book')],
  ['Warlord Trait (Skitarii Veteran Cohort):  Calculate Without Diversion', plain('Calculate Without Diversion', 'Warlord trait · Skitarii Veteran Cohort')],
  ["(Vior'la): Academy Luminary", plain('Academy Luminary', "Vior'la")],
  ['!Warlord Trait: Knight Seneschal', plain('Knight Seneschal', 'Warlord trait')],
  ['[Reference] Discipline: Broodmind', plain('Broodmind', 'Discipline')],
  ['3. Chapter Approved: War Zone Nachmund', plain('War Zone Nachmund', 'Chapter Approved')],
  ['Conversion Beamer (Legends)', { name: 'Conversion Beamer', heading: null, legends: true }],
  ['Storm Eagle Assault Gunship [Legends]', { name: 'Storm Eagle Assault Gunship', heading: null, legends: true }],
  ['<Custom Sept>', plain('Custom Sept')],
  ['Lightning Claw (Pair)', plain('Lightning Claw (Pair)')],
  ['Warlord Trait (Codex 2):Masterwork Bionics', plain('Masterwork Bionics', 'Warlord trait · Codex')],
])('%s', (input, expected) => expect(optionDisplay(input)).toEqual(expected));

test('every surveyed prefix with 5+ uses keeps a non-empty name', () => {
  for (const p of fixture.prefixes.filter((x) => x.count >= 5)) for (const ex of p.examples) expect(optionDisplay(ex).name.length).toBeGreaterThan(0);
});

test('a name with nothing after its prefix falls back to displayName', () => {
  expect(optionDisplay('Stratagem: ').name).toBe('Stratagem:');
  expect(optionDisplay('[Legends]').name).toBe('[Legends]');
});
