import type { SelView } from '@recruit/data/roster';
import { DatasheetView, listSheet } from '../ui/datasheet';
import { Sheet } from '../ui/Sheet';
import { unitName } from './editorView';
import type { UnitInfo } from './unitIndex';

/**
 * A unit's datasheet over the list (or over its editor), so reading it never leaves the list: the unit as listed, each
 * model with what it carries, then only the stats and weapons it has (spec §3.2).
 */
export function DatasheetSheet({ v, info, onClose }: { v: SelView; info: UnitInfo | undefined; onClose: () => void }) {
  return (
    <Sheet kind="full" title={unitName(v.name)} onClose={onClose}>
      {info ? (
        <DatasheetView unit={info.unit} sheet={listSheet(info.unit, v)} headingLevel={2} hideName />
      ) : (
        <p className="muted">There’s no datasheet for this one in the rules data.</p>
      )}
    </Sheet>
  );
}
