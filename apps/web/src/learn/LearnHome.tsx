/** The Learn tab: every lesson, open in any order, with the next one recommended; and "Your first game" once all are done. */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useStorage } from '../storage/StorageContext';
import { IconCheck } from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { allDone, nextLesson, updateProgress } from './progress';
import { useLearnData } from './useLessons';
import { LoadError } from '../layout/OfflineNotice';

declare global {
  interface Window {
    /** DEV only: end-to-end tests mark the whole path done. */
    __learn?: { completeAll(): Promise<void> };
  }
}

export function LearnHome() {
  const data = useLearnData();
  const { user } = useAuth();
  const { repo } = useStorage();
  const order = data.status === 'ready' ? data.order : null;

  useEffect(() => {
    if (!import.meta.env.DEV || !order || !user) return;
    window.__learn = {
      completeAll: async () => {
        await updateProgress(repo, user.id, (p) => ({ ...p, lessons: { ...Object.fromEntries(order.map((id) => [id, { completedAt: Date.now(), mistakes: 0 }])), ...p.lessons } }));
      },
    };
  }, [order, repo, user]);

  if (data.status === 'loading') return <p className="muted">Loading the lessons…</p>;
  if (data.status === 'error') return <LoadError error={data.error} what="the lessons" />;
  const { lessons, progress } = data;
  const doneCount = lessons.filter((l) => progress.lessons[l.id]).length;
  const next = nextLesson(data.order, progress);
  const finished = allDone(data.order, progress);
  const left = lessons.filter((l) => !progress.lessons[l.id]);
  const firstGameNeeds =
    left.length === lessons.length ? `Finish all ${lessons.length} lessons` : left.length === 1 ? `Finish ${left[0].title}` : `Finish the ${left.length} lessons left`;

  return (
    <section className="learn">
      <PageHeader variant="top" title="Learn to play" />
      <p className="learn-intro">Short lessons, each with a drill on a real battlefield with real dice. Take them in order, or start anywhere.</p>
      <div className="learn-meter" role="meter" aria-label="Lessons done" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={doneCount}>
        <div className="learn-meter__bar" style={{ width: `${lessons.length ? (100 * doneCount) / lessons.length : 0}%` }} />
        <span>
          {doneCount} of {lessons.length} lessons done
        </span>
      </div>
      <ol className="learn-path" aria-label="Lessons">
        {lessons.map((l) => {
          const done = !!progress.lessons[l.id];
          const recommended = l.id === next;
          return (
            <li key={l.id} className={`learn-path__item${done ? ' learn-path__item--done' : ''}${recommended ? ' learn-path__item--recommended' : ''}`}>
              <h2 className="learn-path__title">
                <Link to={`/learn/${l.id}`} className="learn-path__link">{`${l.order}. ${l.title}`}</Link>
              </h2>
              <p className="learn-path__summary">{l.summary}</p>
              <span className="learn-path__meta">
                {done && (
                  <span className="status status--ok">
                    <IconCheck size={14} aria-hidden="true" />
                    Done
                  </span>
                )}
                {recommended && <span className="status learn-path__badge">Recommended next</span>}
                <span>{l.minutes} min</span>
              </span>
              {(recommended || done) && (
                <div className="learn-path__actions">
                  {recommended && (
                    <Link to={`/learn/${l.id}`} className="btn btn--primary learn-path__start">
                      Start
                    </Link>
                  )}
                  {done && (
                    <Link to={`/learn/${l.id}/drill`} className="btn learn-path__start" aria-label={`Replay the ${l.title} drill`}>
                      Replay drill
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <section className="card learn-first" aria-label="Your first game">
        <h2>Your first game</h2>
        {finished ? (
          <>
            <p>A 500-point Combat Patrol game: Ultramarines against Necrons, with ready-made armies and hints on.</p>
            <Link to="/learn/first-game" className="btn btn--primary learn-path__start">
              {progress.firstGameId ? 'Continue your first game' : 'Play your first game'}
            </Link>
          </>
        ) : (
          <p className="muted">{firstGameNeeds} to unlock a 500-point game against the Necrons, with hints on.</p>
        )}
      </section>
    </section>
  );
}
