/** Loading a list into Play mode: the rules data it needs, then the read-only army, its rules and its stratagems. */
import type { StratagemOut } from '@recruit/data/model';
import { BATTLE_SIZES, exportText, optionDisplay, validate, type Issue } from '@recruit/data/roster';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { loadEntryInfo } from '../../data/entryInfo';
import { getCatalogue, getCoreStratagems, getIndex, getPolicy, getRosterScope } from '../../factions/dataClient';
import { useStorage } from '../../storage/StorageContext';
import type { ListData } from '../listStore';
import { armyChoices } from '../newListSetup';
import { recoverPending } from '../pendingEdits';
import { loadUnitIndex } from '../unitIndex';
import { slugsFor } from '../useRosterEditor';
import { armyRules, playStratagems, type ArmyRule } from './armyRules';
import { playArmy, type PlayArmy } from './playArmy';

export interface PlayData {
  army: PlayArmy;
  rules: ArmyRule[];
  stratagems: { mine: StratagemOut[]; all: StratagemOut[] };
  issues: Issue[];
  /** The list as text, for "Copy list". */
  text: string;
}

/** Everything Play mode shows for a list, from this device or a share link. */
export async function loadPlayData(data: ListData): Promise<PlayData> {
  const { roster, summary } = data;
  const [{ catalogues }, policy, core] = await Promise.all([getIndex(), getPolicy(), getCoreStratagems()]);
  const primary = catalogues.find((c) => c.id === roster.catalogueId)?.slug ?? summary.catalogueSlug;
  const slugs = slugsFor(roster, catalogues, primary);
  const [scope, units, info, factions] = await Promise.all([getRosterScope(slugs), loadUnitIndex(slugs), loadEntryInfo(slugs), Promise.all(slugs.map(getCatalogue))]);
  const { view, issues } = validate(scope, roster, policy);
  const army = playArmy(view, scope, units);
  const stratagems = playStratagems({
    catalogues: factions,
    core,
    aoo: BATTLE_SIZES[roster.battleSize]?.mode === 'aoo',
    chosen: army.choices.map((c) => c.name),
    offered: armyChoices(scope, roster).flatMap((c) => c.options.map((o) => optionDisplay(o.name).name)),
  });
  return { army, rules: armyRules(army, scope, info, factions), stratagems, issues, text: exportText(view, scope) };
}

export type PlayListState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; listId: string; list: ListData; data: PlayData };

/**
 * A list on this device in Play mode; 'missing' when there is no such list, it was deleted, or it isn't a list. It
 * follows the saved list, so a save that lands after Play mode opened (the editor's last one as you tap Play) shows;
 * the version on screen stays until the new one has loaded. An edit the editor kept aside when its page closed before
 * the save landed is saved back first, as opening the list in the editor would.
 */
export function usePlayList(listId: string): PlayListState {
  const { repo } = useStorage();
  const [state, setState] = useState<{ listId: string; state: PlayListState } | null>(null);
  useEffect(() => {
    let live = true;
    let latest = 0;
    const set = (s: PlayListState) => live && setState({ listId, state: s });
    let sub: { unsubscribe(): void } | undefined;
    recoverPending(repo, [listId])
      .catch((e: unknown) => console.warn('Could not restore unsaved list edits', e))
      .then(() => {
        if (!live) return;
        sub = liveQuery(() => repo.getDoc<ListData>(listId)).subscribe({
          next: (doc) => {
            const run = ++latest;
            if (!doc || doc.deleted || doc.kind !== 'list') return set({ status: 'missing' });
            loadPlayData(doc.data).then(
              (data) => run === latest && set({ status: 'ready', listId, list: doc.data, data }),
              (e: unknown) => run === latest && set({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }),
            );
          },
          error: (e: unknown) => set({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }),
        });
      });
    return () => {
      live = false;
      sub?.unsubscribe();
    };
  }, [repo, listId]);
  return state?.listId === listId ? state.state : { status: 'loading' };
}
