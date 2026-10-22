/** Turning a planned model 15° at a time: oval and rectangular bases (vehicles) often only fit one way round. */
import type { PanelProps } from './types';

const TURN = Math.PI / 12;

/** Turns `modelId`, else the model last dragged, else the plan's first model. Nothing shows without a plan. */
export function TurnButtons({ ui, modelId }: Pick<PanelProps, 'ui'> & { modelId?: string | null }) {
  const plan = ui.plan;
  if (!plan) return null;
  const ids = Object.keys(plan.positions);
  const target = (modelId && plan.positions[modelId] ? modelId : null) ?? (ui.focusModelId && plan.positions[ui.focusModelId] ? ui.focusModelId : null) ?? ids[0];
  if (!target) return null;
  return (
    <div className="play-row" role="group" aria-label="Turn a model">
      <button type="button" className="btn" onClick={() => ui.planDispatch({ type: 'rotate', modelId: target, radians: TURN })}>
        Turn left 15°
      </button>
      <button type="button" className="btn" onClick={() => ui.planDispatch({ type: 'rotate', modelId: target, radians: -TURN })}>
        Turn right 15°
      </button>
    </div>
  );
}
