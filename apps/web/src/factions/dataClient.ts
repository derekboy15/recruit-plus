import type { CatalogueOut, DataIndex, FactionGuide, RulesData, StratagemOut } from '@recruit/data/model';
import type { PolicyData, RosterFile, Scope } from '@recruit/data/roster';

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
      return (await res.json()) as T;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export const getIndex = () => getJson<DataIndex>('/data/index.json');
export const getCatalogue = (slug: string) => getJson<CatalogueOut>(`/data/catalogues/${slug}.json`);
export const getRules = () => getJson<RulesData>('/data/rules.json');
export const getCoreStratagems = () => getJson<StratagemOut[]>('/data/core-stratagems.json');
export const getGuide = (slug: string) => getJson<FactionGuide>(`/data/guides/${slug}.json`);

export const getRosterFile = (slug: string) => getJson<RosterFile>(`/data/roster/${slug}.json`);
export const getPolicy = () => getJson<PolicyData>('/data/roster/policy.json');

const SYSTEM = 'system';
const scopes = new Map<string, Promise<Scope>>();

/**
 * The roster scope for lists that use these catalogues: the union of their `rosterScope` files in order (the first
 * catalogue's first), each file once, the game system last. Memoised by the joined slugs, so asking again for the same
 * catalogues returns the same scope. A list with an ally from another catalogue needs the allied slug added.
 */
export function getRosterScope(catalogueSlugs: string[]): Promise<Scope> {
  const key = catalogueSlugs.join('+');
  let p = scopes.get(key);
  if (!p) {
    p = loadScope(catalogueSlugs);
    p.catch(() => scopes.delete(key));
    scopes.set(key, p);
  }
  return p;
}

async function loadScope(catalogueSlugs: string[]): Promise<Scope> {
  const { catalogues } = await getIndex();
  const slugs: string[] = [];
  for (const slug of catalogueSlugs) {
    const summary = catalogues.find((c) => c.slug === slug);
    if (!summary) throw new Error(`No faction called "${slug}" in the data.`);
    for (const s of summary.rosterScope) if (s !== SYSTEM && !slugs.includes(s)) slugs.push(s);
  }
  // Loaded on demand: the roster engine stays out of the main bundle (only the builder pages need it).
  const [{ buildScope }, files] = await Promise.all([import('@recruit/data/roster'), Promise.all([...slugs, SYSTEM].map(getRosterFile))]);
  return buildScope(files);
}

/** Test helper. */
export function resetDataCache() {
  cache.clear();
  scopes.clear();
}
