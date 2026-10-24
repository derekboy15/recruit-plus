/**
 * A − n + control with 44px buttons. With `grid` (the odds tool) the label and the buttons are two sibling cells of
 * the surrounding grid, so the buttons line up with the other controls.
 */
export function Stepper({ label, value, onChange, min = 0, max, grid = false }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; grid?: boolean;
}) {
  const name = <span className="stepper__label">{label}</span>;
  const controls = (
    <>
      <button type="button" className="btn btn--small" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="btn btn--small" aria-label={`More: ${label}`} disabled={max !== undefined && value >= max} onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}>+</button>
    </>
  );
  if (grid) {
    return (
      <>
        {name}
        <span className="stepper stepper--grid">{controls}</span>
      </>
    );
  }
  return (
    <div className="stepper">
      {name}
      {controls}
    </div>
  );
}
