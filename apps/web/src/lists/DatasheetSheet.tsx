import { unitSummary, type SelView } from '@recruit/data/roster';
import { DatasheetView } from '../ui/datasheet';
import { Sheet } from '../ui/Sheet';
import { unitName } from './editorView';
import type { UnitInfo } from './unitIndex';

/**
 * A unit's datasheet over the list (or over its editor), so reading it never leaves the list. The weapons the unit
 * has come first, with how many; its other wargear options are folded away.
 */
export function DatasheetSheet({ v, info, onClose }: { v: SelView; info: UnitInfo | undefined; onClose: () => void }) {
  return (
    <Sheet kind="full" title={unitName(v.name)} onClose={onClose}>
      {info ? (
        <DatasheetView unit={info.unit} taken={unitSummary(v).gear} headingLevel={2} hideName />
      ) : (
        <p className="muted">There’s no datasheet for this one in the rules data.</p>
      )}
    </Sheet>
  );
}
