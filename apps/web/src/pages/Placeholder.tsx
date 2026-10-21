export function Placeholder({ title, milestone, blurb }: { title: string; milestone: number; blurb: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <div className="card">
        <p>{blurb}</p>
        <p className="muted">Arrives in Milestone {milestone}.</p>
      </div>
    </section>
  );
}
