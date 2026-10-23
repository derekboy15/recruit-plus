/** Node side of the missions: pack rules, Wahapedia secondaries, the faction mapping, amendments, plain English and generated/missions.json. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { BuildOptions } from '../build';
import { checkPlain } from '../plain/check';
import { officialFor, textKey } from '../plain/collect';
import { htmlToText, slugify, titleCase } from '../text';
import type { Wahapedia } from '../wahapedia/load';
import { validateMap } from './geometry';
import type { MissionOut, MissionsOut, Pack, PackOut, RulesText, SecondaryFaction, SecondaryOut } from './types';

const GAME: Record<Pack, string> = { 'arks-of-omen': 'Arks of Omen: Grand Tournament', 'core-book': 'Matched Play' };
const PREFIX: Record<Pack, string> = { 'arks-of-omen': 'aoo', 'core-book': 'cb' };
const TYPES: Record<string, SecondaryOut['type']> = {
  'Progressive Objective': 'progressive',
  'End Game Objective': 'end-game',
  'Progressive and End Game Objective': 'progressive-and-end-game',
};

/** A Wahapedia secondary filed under the wrong faction (overrides/secondary-corrections.json). */
export interface SecondaryCorrection { pack: Pack; name: string; fromFactionId: string; factionId: string; faction: string; source: string }

export function loadSecondaryCorrections(overridesDir: string): SecondaryCorrection[] {
  return JSON.parse(readFileSync(join(overridesDir, 'secondary-corrections.json'), 'utf8'));
}

/** The pack's secondary objectives from Wahapedia's Secondaries.csv (flavour `legend` dropped), corrections applied. */
export function extractSecondaries(w: Wahapedia, pack: Pack, corrections: SecondaryCorrection[] = []): SecondaryOut[] {
  const mine = corrections.filter((c) => c.pack === pack);
  const used = new Set<SecondaryCorrection>();
  const out = w.secondaries
    .filter((r) => r.game === GAME[pack])
    .map((r) => {
      const name = titleCase(r.name.trim());
      const type = TYPES[r.type.trim()];
      if (!type) throw new Error(`Unknown secondary type "${r.type}" for ${r.name}`);
      const fix = mine.find((c) => c.name === name && c.fromFactionId === r.faction_id.trim());
      if (fix) used.add(fix);
      const factionId = fix?.factionId ?? (r.faction_id.trim() || undefined);
      const faction = fix?.faction ?? r.faction_name.trim();
      const id = [PREFIX[pack], factionId?.toLowerCase(), slugify(name)].filter(Boolean).join('-');
      return {
        id,
        name,
        category: r.category.trim(),
        type,
        ...(factionId ? { factionId, faction } : {}),
        text: htmlToText(r.description),
      };
    });
  for (const c of mine) if (!used.has(c)) throw new Error(`secondary-corrections.json: no ${c.pack} secondary "${c.name}" with faction ${c.fromFactionId}`);
  return out;
}

export function loadPacks(missionsDir: string): Omit<PackOut, 'secondaries'>[] {
  return JSON.parse(readFileSync(join(missionsDir, 'packs.json'), 'utf8'));
}

export interface SecondaryFactionEntry { catalogueName: string; factions: SecondaryFaction[]; source: string }
export function loadSecondaryFactions(overridesDir: string): SecondaryFactionEntry[] {
  return JSON.parse(readFileSync(join(overridesDir, 'secondary-factions.json'), 'utf8'));
}

export interface MissionAmendment { target: string; field: string; text: string; source: string }
export function loadAmendments(overridesDir: string): { note?: string; items: MissionAmendment[] } {
  return JSON.parse(readFileSync(join(overridesDir, 'mission-amendments.json'), 'utf8'));
}

/** Mission files in `missions/` (every .json except packs.json), in file order. */
export function loadMissions(missionsDir: string): MissionOut[] {
  return readdirSync(missionsDir)
    .filter((f) => f.endsWith('.json') && f !== 'packs.json')
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(missionsDir, f), 'utf8')) as MissionOut[]);
}

/** Plain English for mission texts: packages/content/missions/plain.json, keyed by textKey(official). */
export interface MissionPlainEntry { name: string; kind: 'mission' | 'secondary'; plain: string; waive?: Record<string, string> }
export interface MissionsReport {
  /** Mission texts and universal/mission secondaries: these must all have checked plain English. */
  total: number;
  written: number;
  missing: string[];
  flagged: { key: string; name: string; missing: string[]; extra: string[]; copied: boolean }[];
  orphans: string[];
  /** Faction secondaries, which may show official wording only. */
  faction: { total: number; written: number };
}

interface PlainTarget { key: string; name: string; faction: boolean; official: string; set(plain: string): void }

function applyMissionAmendments(missions: MissionOut[], packs: PackOut[], items: MissionAmendment[]): void {
  for (const a of items) {
    const [first, second] = a.target.split('/');
    const mission = missions.find((m) => m.id === first);
    const target = mission
      ? second === undefined ? undefined : [...mission.rules, mission.primary, ...(mission.missionSecondary ? [mission.missionSecondary] : [])].find((r) => r.id === second)
      : packs.flatMap((p) => p.secondaries).find((s) => s.id === first);
    if (!target || a.field !== 'text') throw new Error(`mission-amendments.json: unknown target "${a.target}" or field "${a.field}"`);
    target.amended = a.text;
  }
}

function plainTargets(missions: MissionOut[], packs: PackOut[]): PlainTarget[] {
  const of = (r: RulesText | SecondaryOut, faction: boolean): PlainTarget => {
    const official = officialFor(r.text, r.amended);
    return { key: textKey(official), name: r.name, faction, official, set: (plain) => { r.plain = plain; } };
  };
  return [
    ...missions.flatMap((m) => [...m.rules, m.primary, ...(m.missionSecondary ? [m.missionSecondary] : [])].map((r) => of(r, false))),
    ...packs.flatMap((p) => p.secondaries.map((s) => of(s, Boolean(s.faction)))),
  ];
}

/** Builds generated/missions.json and generated/missions-report.json. */
export function writeMissions(opts: BuildOptions, w: Wahapedia): MissionsReport {
  const missionsDir = join(dirname(opts.overridesDir), 'missions');
  const missions = loadMissions(missionsDir);
  const corrections = loadSecondaryCorrections(opts.overridesDir);
  const packs: PackOut[] = loadPacks(missionsDir).map((p) => ({ ...p, secondaries: extractSecondaries(w, p.id, corrections) }));
  for (const m of missions) {
    const problems = validateMap(m.map);
    if (problems.length) throw new Error(`${m.id} map: ${problems.join('; ')}`);
  }
  applyMissionAmendments(missions, packs, loadAmendments(opts.overridesDir).items);

  const plainFile = opts.contentDir ? join(opts.contentDir, 'missions', 'plain.json') : '';
  const store: Record<string, MissionPlainEntry> = plainFile && existsSync(plainFile) ? JSON.parse(readFileSync(plainFile, 'utf8')) : {};
  const report: MissionsReport = { total: 0, written: 0, missing: [], flagged: [], orphans: [], faction: { total: 0, written: 0 } };
  const used = new Set<string>();
  for (const t of plainTargets(missions, packs)) {
    if (t.faction) report.faction.total++;
    else report.total++;
    const entry = store[t.key];
    if (!entry) {
      report.missing.push(`${t.key} ${t.name}`);
      continue;
    }
    used.add(t.key);
    const verdict = checkPlain(t.official, entry.plain, entry.waive);
    if (!verdict.ok) {
      report.flagged.push({ key: t.key, name: t.name, missing: verdict.missing.map((x) => x.value), extra: verdict.extra.map((x) => x.value), copied: verdict.copy.copied });
      continue;
    }
    t.set(entry.plain);
    if (t.faction) report.faction.written++;
    else report.written++;
  }
  report.orphans = Object.keys(store).filter((k) => !used.has(k));
  report.missing = [...new Set(report.missing)];

  const secondaryFactions: MissionsOut['secondaryFactions'] = {};
  for (const e of loadSecondaryFactions(opts.overridesDir)) secondaryFactions[slugify(e.catalogueName)] = e.factions;
  const out: MissionsOut = { generatedAt: new Date().toISOString(), packs, missions, secondaryFactions };
  writeFileSync(join(opts.outDir, 'missions.json'), JSON.stringify(out));
  writeFileSync(join(opts.outDir, 'missions-report.json'), JSON.stringify(report, null, 2));
  return report;
}
