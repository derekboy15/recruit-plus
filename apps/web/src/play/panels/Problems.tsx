import type { Problem } from '@recruit/engine';

/** The engine's reasons for refusing an action: each message, then the rule it comes from. */
export function Problems({ problems }: { problems: Problem[] }) {
  if (!problems.length) return null;
  return (
    <div role="alert" className="play-problems">
      {problems.map((p, i) => (
        <p key={`${p.code}-${i}`}>
          {p.message} <span className="muted play-rule">{p.rule}</span>
        </p>
      ))}
    </div>
  );
}
