/** Opens "Your first game" (creating it the first time) once every lesson is done. */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { GameData } from '../play/store/gameStore';
import { useStorage } from '../storage/StorageContext';
import { createFirstGame } from './firstGame';
import { allDone, updateProgress } from './progress';
import { useLearnData } from './useLessons';

export function FirstGamePage() {
  const data = useLearnData();
  const { user } = useAuth();
  const { repo } = useStorage();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef<number | null>(null);
  const ready = data.status === 'ready' && allDone(data.order, data.progress);
  const firstGameId = data.status === 'ready' ? data.progress.firstGameId : undefined;

  useEffect(() => {
    if (!ready || !user || started.current === attempt) return;
    started.current = attempt;
    void (async () => {
      try {
        const existing = firstGameId ? await repo.getDoc<GameData>(firstGameId) : undefined;
        if (existing && !existing.deleted) return navigate(`/play/${existing.id}`, { replace: true });
        const id = await createFirstGame(repo, user.id, crypto.getRandomValues(new Uint32Array(1))[0]);
        await updateProgress(repo, user.id, (p) => ({ ...p, firstGameId: id }));
        navigate(`/play/${id}`, { replace: true });
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [ready, user, repo, firstGameId, navigate, attempt]);

  if (data.status === 'loading') return <p className="muted">Loading…</p>;
  if (data.status === 'error') return <p role="alert">Couldn’t load the lessons: {data.error.message}</p>;
  if (!ready)
    return (
      <section className="learn">
        <h1>Your first game</h1>
        <p>Finish all {data.lessons.length} lessons to unlock your first game.</p>
        <Link to="/learn" className="btn btn--primary learn-path__start">
          Back to Learn
        </Link>
      </section>
    );
  if (error)
    return (
      <section className="learn">
        <h1>Your first game</h1>
        <p role="alert">Your first game couldn’t be set up: {error}</p>
        <button type="button" className="btn btn--primary" onClick={() => (setError(null), setAttempt((a) => a + 1))}>
          Try again
        </button>
      </section>
    );
  return <p className="muted">Setting up your first game…</p>;
}
