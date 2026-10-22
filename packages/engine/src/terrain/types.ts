/** Terrain features: one category and any number of traits (TR §1). Buildings are units, not terrain (TR §2). */
import type { Pt } from '../geometry/shapes';

export type TerrainCategory = 'hill' | 'obstacle' | 'area';
export type TerrainTrait =
  | 'light-cover' | 'heavy-cover' | 'dense-cover' | 'exposed-position' | 'breachable' | 'scaleable'
  | 'difficult-ground' | 'unstable-position' | 'obscuring' | 'defensible' | 'defence-line' | 'inspiring';

export interface TerrainFeature {
  id: string;
  name: string;
  category: TerrainCategory;
  /** The agreed ground-level footprint (TR §2). */
  footprint: Pt[];
  /** Inches. */
  height: number;
  traits: TerrainTrait[];
  /** Inspiring (IMPERIUM): only units with one of these keywords benefit; none listed = every unit (TR §3.3). */
  inspiringKeywords?: string[];
}

export type TerrainPreset = 'ruins' | 'craters' | 'woods' | 'industrial' | 'containers' | 'barricades' | 'debris' | 'statuary' | 'ruined-walls';

/** The Core Book's common terrain features (TR §4). */
export const TERRAIN_PRESETS: Record<TerrainPreset, { category: TerrainCategory; traits: TerrainTrait[] }> = {
  ruins: { category: 'area', traits: ['scaleable', 'breachable', 'light-cover', 'defensible', 'obscuring'] },
  craters: { category: 'area', traits: ['light-cover', 'difficult-ground'] },
  woods: { category: 'area', traits: ['dense-cover', 'breachable', 'defensible', 'difficult-ground'] },
  industrial: { category: 'area', traits: ['scaleable', 'breachable', 'dense-cover', 'defensible'] },
  containers: { category: 'obstacle', traits: ['light-cover', 'scaleable', 'exposed-position'] },
  barricades: { category: 'obstacle', traits: ['defence-line', 'light-cover', 'heavy-cover', 'defensible', 'unstable-position', 'difficult-ground'] },
  debris: { category: 'obstacle', traits: ['exposed-position'] },
  statuary: { category: 'obstacle', traits: ['light-cover', 'unstable-position', 'inspiring'] },
  'ruined-walls': { category: 'obstacle', traits: ['defence-line', 'breachable', 'dense-cover', 'defensible', 'unstable-position'] },
};

export const hasTrait = (f: TerrainFeature, t: TerrainTrait) => f.traits.includes(t);
