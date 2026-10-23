/** A lesson: its short explanation, the key words (from the glossary), links into the Rules Reference, and its drill. */
import type { Lesson } from '@recruit/data/model';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { RendererFactory } from '../play/board/BoardCanvas';
import { Blocks } from '../rules/Blocks';
import { useStorage } from '../storage/StorageContext';
import { DrillScreen } from './drill/DrillScreen';
import { DRILLS } from './drills';
import { completeLesson } from './progress';
import { lockOf, useLearnData } from './useLessons';

function useLesson() {
  const { lessonId = '' } = useParams();
  const data = useLearnData();
  if (data.status !== 'ready') return { data, lesson: undefined };
  return { data, lesson: data.lessons.find((l) => l.id === lessonId) };
}

const nextOf = (lessons: Lesson[], lesson: Lesson) => lessons[lessons.indexOf(lesson) + 1] ?? null;

/** Shown for missing lessons, data errors and locked lessons; null when the lesson can be shown. */
function Gate({ data, lesson }: ReturnType<typeof useLesson>) {
  if (data.status === 'loading') return <p className="muted">Loading the lesson…</p>;
  if (data.status === 'error') return <p role="alert">Couldn’t load the lesson: {data.error.message}</p>;
  const back = (
    <p>
      <Link to="/learn">← Learn</Link>
    </p>
  );
  if (!lesson)
    return (
      <section>
        {back}
        <p role="alert">That lesson doesn&apos;t exist.</p>
      </section>
    );
  const lock = lockOf(data.lessons, data.progress, lesson);
  if (lock.open) return null;
  return (
    <section>
      {back}
      <h1>{lesson.title}</h1>
      <p>Finish {lock.before.title} first.</p>
      {lock.next && (
        <Link to={`/learn/${lock.next.id}`} className="btn btn--primary learn-path__start">
          Go to {lock.next.title}
        </Link>
      )}
    </section>
  );
}

export function LessonPage() {
  const l = useLesson();
  const gate = Gate(l);
  if (gate || l.data.status !== 'ready' || !l.lesson) return gate;
  const { lessons, glossary, progress } = l.data;
  const lesson = l.lesson;
  const done = !!progress.lessons[lesson.id];
  const next = nextOf(lessons, lesson);
  return (
    <article className="learn learn-lesson">
      <p>
        <Link to="/learn">← Learn</Link>
      </p>
      <p className="muted">
        Lesson {lesson.order} of {lessons.length} · {lesson.minutes} minutes
      </p>
      <h1>{lesson.title}</h1>
      <Blocks blocks={lesson.intro} />
      {lesson.sections.map((s) => (
        <section key={s.id}>
          <h2 id={s.id}>{s.title}</h2>
          <Blocks blocks={s.blocks} />
        </section>
      ))}
      {lesson.glossary.length > 0 && (
        <section aria-label="Key words" className="card learn-words">
          <h2>Key words</h2>
          <dl>
            {lesson.glossary.map((id) => {
              const term = glossary.find((g) => g.id === id);
              if (!term) return null;
              return (
                <div key={id}>
                  <dt>
                    <Link to={`/rules/glossary#${id}`}>{term.term}</Link>
                  </dt>
                  <dd>
                    <Blocks blocks={term.blocks} />
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
      {lesson.rules.length > 0 && (
        <section aria-label="In the Rules Reference" className="learn-refs">
          <h2>In the Rules Reference</h2>
          <ul>
            {lesson.rules.map((r) => (
              <li key={`${r.article}#${r.section}`}>
                <Link to={`/rules/${r.article}#${r.section}`} className="learn-path__link">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {done && <p className="status status--ok learn-done">You&apos;ve finished this lesson</p>}
      <div className="play-row">
        <Link to={`/learn/${lesson.id}/drill`} className="btn btn--primary learn-path__start">
          {done ? 'Do the drill again' : 'Start the drill'}
        </Link>
        {done && next && (
          <Link to={`/learn/${next.id}`} className="btn learn-path__start">
            Next lesson
          </Link>
        )}
      </div>
    </article>
  );
}

export function DrillRoute({ renderer }: { renderer?: RendererFactory }) {
  const l = useLesson();
  const { user } = useAuth();
  const { repo } = useStorage();
  const lessonId = l.lesson?.id;
  const onDone = useCallback(
    (mistakes: number) => {
      if (user && lessonId) void completeLesson(repo, user.id, lessonId, mistakes);
    },
    [repo, user, lessonId],
  );
  const gate = Gate(l);
  if (gate || l.data.status !== 'ready' || !l.lesson) return gate;
  const drill = DRILLS[l.lesson.drill];
  if (!drill) return <p role="alert">This drill isn&apos;t ready yet.</p>;
  const next = nextOf(l.data.lessons, l.lesson);
  return <DrillScreen drill={drill} renderer={renderer} onDone={onDone} exitTo={`/learn/${l.lesson.id}`} next={next ? { to: `/learn/${next.id}`, label: 'Next lesson' } : null} />;
}
