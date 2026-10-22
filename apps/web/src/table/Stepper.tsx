/** A − n + control with 44px buttons. */
export function Stepper({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="stepper">
      <span className="stepper__label">{label}</span>
      <button type="button" className="btn btn--small" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="btn btn--small" aria-label={`More: ${label}`} disabled={max !== undefined && value >= max} onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}>+</button>
    </div>
  );
}
