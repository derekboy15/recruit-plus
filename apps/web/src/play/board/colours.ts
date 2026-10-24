/** Terrain colours and names, shared by the board renderer and the map key (kept apart from pixi, which loads lazily). */
export const TERRAIN_COLOURS = { ruin: '#77736b', woods: '#3e6b3a', crater: '#6b4f35', other: '#5b5b5b' } as const;

export const TERRAIN_NAMES = {
  ruin: 'Ruins: block sight',
  woods: 'Woods: dense cover',
  crater: 'Craters: difficult ground',
  other: 'Other terrain',
} as const;
