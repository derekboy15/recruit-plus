import { useAsync } from '../factions/useAsync';
import { loadEntryInfo, type EntryInfoIndex } from '../data/entryInfo';

/**
 * What each option of these catalogues is and does (the info files), loaded once per set of slugs. Null while it loads;
 * a file that fails to load is left out (loadEntryInfo never rejects), so options just show no description.
 */
export function useEntryInfo(slugs: string[]): EntryInfoIndex | null {
  const state = useAsync(() => loadEntryInfo(slugs), slugs.join('+'));
  return state.status === 'ready' ? state.data : null;
}
