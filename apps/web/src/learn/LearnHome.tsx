/** The Learn tab: the lesson path in order, how far you are, and "Your first game" once every lesson is done. */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useStorage } from '../storage/StorageContext';
import { allDone, nextLesson, updateProgress } from './progress';
import { useLearnData } from './useLessons';
import { LoadError } from '../layout/OfflineNotice';

declare global {
  interface Window {
    /** DEV only: end-to-end tests unlock the whole path. */
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

  return (
    <section className="learn">
      <h1>Learn to play</h1>
      <p>Short lessons, each with a drill on a real battlefield with real dice. Finish them in order.</p>
      <div className="learn-meter" role="meter" aria-label="Lessons done" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={doneCount}>
        <div className="learn-meter__bar" style={{ width: `${lessons.length ? (100 * doneCount) / lessons.length : 0}%` }} />
        <span>
          {doneCount} of {lessons.length} lessons done
        </span>
      </div>
      <ol className="learn-path" aria-label="Lessons">
        {lessons.map((l, i) => {
          const done = !!progress.lessons[l.id];
          const isNext = l.id === next;
          const heading = <h2 className="learn-path__title">{`${l.order}. ${l.title}`}</h2>;
          return (
            <li key={l.id} className={`learn-path__item learn-path__item--${done ? 'done' : isNext ? 'next' : 'locked'}`}>
              {done ? (
                <Link to={`/learn/${l.id}`} className="learn-path__link">
                  {heading}
                  <span className="learn-path__meta">
                    <span className="status status--ok">Done</span> {l.minutes} min
                  </span>
                </Link>
              ) : isNext ? (
                <div className="learn-path__body">
                  {heading}
                  <p className="learn-path__summary">{l.summary}</p>
                  <span className="learn-path__meta">
                    <span className="status">Next</span> {l.minutes} min
                  </span>
                  <Link to={`/learn/${l.id}`} className="btn btn--primary learn-path__start">
                    Start
                  </Link>
                </div>
              ) : (
                <div className="learn-path__body" aria-disabled="true">
                  {heading}
                  <span className="learn-path__meta">
                    <span className="status">Locked</span> <span>Finish lesson {i} first</span>
                  </span>
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
          <p className="muted">Finish all {lessons.length} lessons to unlock a 500-point game against the Necrons, with hints on.</p>
        )}
      </section>
    </section>
  );
}
