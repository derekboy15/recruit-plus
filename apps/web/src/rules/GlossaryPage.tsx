import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { Blocks } from './Blocks';
import { ReportButton } from './ReportButton';
import { useScrollToHash } from './RulesArticlePage';

export function GlossaryPage() {
  const state = useAsync(getRules, 'rules');
  const [filter, setFilter] = useState('');
  useScrollToHash(state.status === 'ready');
  if (state.status === 'loading') return <p className="muted">Loading the glossary…</p>;
  if (state.status === 'error') return <p role="alert">Couldn’t load the glossary: {state.error.message}</p>;
  const f = filter.trim().toLowerCase();
  const terms = [...state.data.glossary]
    .sort((a, b) => a.term.localeCompare(b.term))
    .filter((g) => !f || g.term.toLowerCase().includes(f) || g.text.toLowerCase().includes(f));
  return (
    <section>
      <p>
        <Link to="/rules">← Rules</Link>
      </p>
      <h1>Glossary</h1>
      <input className="input" type="search" aria-label="Filter terms" placeholder="Filter terms" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {terms.map((g) => (
        <section key={g.id} className="rules-section">
          <h2 id={g.id}>{g.term}</h2>
          <Blocks blocks={g.blocks} />
          <ReportButton target={{ kind: 'glossary', name: g.term }} text={g.text} />
        </section>
      ))}
      {terms.length === 0 && <p className="muted">No terms match.</p>}
    </section>
  );
}
