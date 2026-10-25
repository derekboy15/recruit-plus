/** A lesson: its short explanation, the key words (from the glossary), links into the Rules Reference, and its drill. */
import type { Lesson } from '@recruit/data/model';
import { lazy, Suspense, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { RendererFactory } from '../play/board/BoardCanvas';
import { Blocks } from '../rules/Blocks';
import { useStorage } from '../storage/StorageContext';
import { PageHeader } from '../ui/PageHeader';
import { completeLesson } from './progress';
import { useLearnData } from './useLessons';
import { LoadError } from '../layout/OfflineNotice';

// The drills bring the engine and the board: they load only when a drill opens.
const DrillHost = lazy(() => import('./drill/DrillHost'));

function useLesson() {
  const { lessonId = '' } = useParams();
  const data = useLearnData();
  if (data.status !== 'ready') return { data, lesson: undefined };
  return { data, lesson: data.lessons.find((l) => l.id === lessonId) };
}

const nextOf = (lessons: Lesson[], lesson: Lesson) => lessons[lessons.indexOf(lesson) + 1] ?? null;

/** Shown while loading, for data errors and for missing lessons; null when the lesson can be shown. Every lesson is open. */
function Gate({ data, lesson }: ReturnType<typeof useLesson>) {
  if (data.status === 'loading') return <p className="muted">Loading the lesson…</p>;
  if (data.status === 'error') return <LoadError error={data.error} what="the lesson" />;
  if (!lesson)
    return (
      <section>
        <PageHeader title="Lesson not found" back={{ to: '/learn', label: 'Learn' }} />
        <p role="alert">That lesson doesn&apos;t exist.</p>
      </section>
    );
  return null;
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
      <PageHeader back={{ to: '/learn', label: 'Learn' }} title={lesson.title} subtitle={`Lesson ${lesson.order} of ${lessons.length} · ${lesson.minutes} min`} />
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
                  <dt>{term.term}</dt>
                  <dd>
                    <Blocks blocks={term.blocks} />
                  </dd>
                </div>
              );
            })}
          </dl>
          <Link to="/rules/glossary" className="btn btn--tertiary learn-words__all">
            All key words in the glossary
          </Link>
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
      {/* Always on screen while the lesson scrolls: the drill is the point of the lesson. */}
      <div className="learn-start-bar">
        <Link to={`/learn/${lesson.id}/drill`} className="btn btn--primary">
          {done ? 'Do the drill again' : `Start the drill · ${lesson.minutes} min`}
        </Link>
        {done && next && (
          <Link to={`/learn/${next.id}`} className="btn">
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
  const next = nextOf(l.data.lessons, l.lesson);
  return (
    <Suspense fallback={<p className="muted">Setting up the drill…</p>}>
      <DrillHost
        drillId={l.lesson.drill}
        renderer={renderer}
        onDone={onDone}
        exitTo={`/learn/${l.lesson.id}`}
        next={next ? { to: `/learn/${next.id}`, label: 'Next lesson' } : null}
      />
    </Suspense>
  );
}
