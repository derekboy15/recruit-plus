import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { Blocks } from './Blocks';
import { ReportButton } from './ReportButton';
import { LoadError } from '../layout/OfflineNotice';

/** Scrolls to the element named by the URL hash once the page's content is on screen. */
export function useScrollToHash(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (ready && hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [ready, hash]);
}

export function RulesArticlePage() {
  const { articleId = '' } = useParams();
  const state = useAsync(getRules, 'rules');
  const article = state.status === 'ready' ? state.data.articles.find((a) => a.id === articleId) : undefined;
  useScrollToHash(!!article);

  if (state.status === 'loading') return <p className="muted">Loading the rules…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="the rules" />;
  const back = (
    <p>
      <Link to="/rules">← Rules</Link>
    </p>
  );
  if (!article) {
    return (
      <section>
        {back}
        <p role="alert">That rules page doesn&apos;t exist.</p>
      </section>
    );
  }
  return (
    <article>
      {back}
      <h1>{article.title}</h1>
      <Blocks blocks={article.intro} />
      {article.sections.map((s) => (
        <section key={s.id} className="rules-section">
          <h2 id={s.id}>{s.title}</h2>
          <Blocks blocks={s.blocks} />
          <ReportButton target={{ kind: 'rules-section', name: `${article.title}: ${s.title}` }} text={s.text} />
        </section>
      ))}
    </article>
  );
}
