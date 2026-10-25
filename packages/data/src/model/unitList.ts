import type { CatalogueOut, UnitListOut } from './types';

/**
 * A catalogue's unit list (generated/units/<slug>.json): each unit with only what the faction page shows (name, role,
 * badges, points, size and the stat lines its key stats come from), so the page doesn't download per-model data.
 */
export function unitList(cat: CatalogueOut): UnitListOut {
  return {
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    library: cat.library,
    units: cat.units.map((u) => ({
      id: u.id,
      slug: u.slug,
      name: u.name,
      role: u.role,
      legends: u.legends,
      forgeWorld: u.forgeWorld,
      ...(u.needs && { needs: u.needs }),
      points: u.points,
      minModels: u.minModels,
      maxModels: u.maxModels,
      models: u.models,
    })),
  };
}
