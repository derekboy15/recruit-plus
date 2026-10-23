import { Route, Routes } from 'react-router-dom';
import type { RendererFactory } from '../play/board/BoardCanvas';
import { FirstGamePage } from './FirstGamePage';
import { LearnHome } from './LearnHome';
import { DrillRoute, LessonPage } from './LessonPage';
import './learn.css';

/** The Learn tab: the lesson path, each lesson and its drill, and "Your first game". Loaded on first visit to /learn. */
export function LearnRoutes({ renderer }: { renderer?: RendererFactory } = {}) {
  return (
    <Routes>
      <Route index element={<LearnHome />} />
      <Route path="first-game" element={<FirstGamePage />} />
      <Route path=":lessonId" element={<LessonPage />} />
      <Route path=":lessonId/drill" element={<DrillRoute renderer={renderer} />} />
    </Routes>
  );
}
