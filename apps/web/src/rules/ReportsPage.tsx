import { PageHeader } from '../ui/PageHeader';
import { PROBLEM_LABELS, useReports } from './reports';

/** The signed-in user's rules error reports, newest first. */
export function ReportsPage() {
  const { reports, loading } = useReports();
  return (
    <section>
      <PageHeader title="Your rules reports" back={{ to: '/rules', label: 'Rules' }} />
      {loading ? (
        <p className="muted">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="muted">You haven&apos;t reported anything yet.</p>
      ) : (
        <ul className="list">
          {reports.map((r) => (
            <li key={r.id} className="card">
              <div className="choice__head">
                <strong>{r.data.target.name}</strong>
                <span className="muted">{new Date(r.updatedAt).toLocaleDateString('en-GB')}</span>
              </div>
              <p className="muted" style={{ margin: '0.25rem 0' }}>
                {PROBLEM_LABELS[r.data.problem]}
              </p>
              {r.data.note && <p style={{ margin: 0 }}>{r.data.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
