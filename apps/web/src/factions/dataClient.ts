import type { CatalogueOut, DataIndex } from '@recruit/data/model';

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

/** Test helper. */
export function resetDataCache() {
  cache.clear();
}
