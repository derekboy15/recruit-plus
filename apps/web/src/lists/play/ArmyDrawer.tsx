/**
 * The Table companion's army drawer (spec §4): Play mode's read-only army in one full sheet, titled with the list's
 * name. One sheet at a time: a unit's datasheet (or the rules, or the stratagems) takes the army's place, and "Back to
 * army" brings it back.
 */
import { useState } from 'react';
import { LoadError } from '../../layout/OfflineNotice';
import { Sheet } from '../../ui/Sheet';
import { usePlayList } from './loadPlayData';
import { PlayArmyView, type PlaySheet } from './PlayArmyView';
import { PlaySheets } from './PlaySheets';

export function ArmyDrawer({ listId, onClose }: { listId: string; onClose: () => void }) {
  const state = usePlayList(listId);
  const [open, setOpen] = useState<PlaySheet | null>(null);

  // A unit the list no longer has (it changed while open) shows the army again.
  const shown = open && state.status === 'ready' && (open.kind !== 'unit' || state.data.army.units.some((u) => u.selId === open.selId));
  if (shown && state.status === 'ready') return <PlaySheets data={state.data} open={open} onOpen={setOpen} closeLabel="Back to army" />;
  return (
    <Sheet kind="full" title={state.status === 'ready' ? state.data.army.name : 'Your army'} onClose={onClose}>
      {state.status === 'loading' && <p className="muted">Loading your army…</p>}
      {state.status === 'missing' && <p>This list isn’t on this device any more.</p>}
      {state.status === 'error' && <LoadError error={state.error} what="this list" />}
      {state.status === 'ready' && <PlayArmyView data={state.data} onOpen={setOpen} />}
    </Sheet>
  );
}
