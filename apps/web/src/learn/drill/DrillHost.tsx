/** A lesson's drill, by id: loaded lazily with the drills, the engine and the board (the Learn pages stay light). */
import type { RendererFactory } from '../../play/board/BoardCanvas';
import { DRILLS } from '../drills';
import { DrillScreen } from './DrillScreen';
import { ListDrillScreen } from './ListDrillScreen';
import { isListDrill } from './types';

export interface DrillHostProps {
  drillId: string;
  onDone(mistakes: number): void;
  exitTo: string;
  next: { to: string; label: string } | null;
  renderer?: RendererFactory;
}

export default function DrillHost({ drillId, renderer, ...props }: DrillHostProps) {
  const drill = DRILLS[drillId];
  if (!drill) return <p role="alert">This drill isn&apos;t ready yet.</p>;
  return isListDrill(drill) ? <ListDrillScreen drill={drill} {...props} /> : <DrillScreen drill={drill} renderer={renderer} {...props} />;
}
