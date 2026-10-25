import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCoreStratagems, getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { search, searchDocs, type SearchDoc } from './search';
import { LoadError } from '../layout/OfflineNotice';
import { PageHeader } from '../ui/PageHeader';

const KIND_LABELS: Record<SearchDoc['kind'], string> = { section: 'Rules', term: 'Glossary', stratagem: 'Core stratagem' };

const MORE = [
  { to: '/factions', title: 'Factions and datasheets', blurb: 'Every army’s units, datasheets and stratagems.' },
  { to: '/rules/glossary', title: 'Glossary', blurb: 'Every game term and keyword, A to Z.' },
  { to: '/rules/stratagems', title: 'Core stratagems', blurb: 'The stratagems every army can use.' },
  { to: '/rules/factions', title: 'Faction guides', blurb: 'How each army plays, its rules and key units.' },
  { to: '/rules/reports', title: 'Your rules reports', blurb: 'Errors you have reported.' },
];

/** The Rules Reference: search across the core rules, glossary and core stratagems, or browse by article. */
export function RulesHome() {
  const state = useAsync(() => Promise.all([getRules(), getCoreStratagems()]), 'rules');
  const [query, setQuery] = useState('');
  const docs = useMemo(() => (state.status === 'ready' ? searchDocs(...state.data) : []), [state]);
  const hits = useMemo(() => search(docs, query), [docs, query]);

  const header = <PageHeader variant="top" title="Rules" />;
  if (state.status === 'loading') return <section>{header}<p className="muted">Loading the rules…</p></section>;
  if (state.status === 'error') return <section>{header}<LoadError error={state.error} what="the rules" /></section>;
  const [rules] = state.data;
  const q = query.trim();

  return (
    <section>
      {header}
      <input
        className="input"
        type="search"
        aria-label="Search the rules"
        placeholder='Try "look out sir" or "overwatch"'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: '1rem' }}
      />
      {q ? (
        hits.length ? (
          <ul className="list" aria-label="Search results">
            {hits.map(({ doc, snippet }) => (
              <li key={doc.id}>
                <Link className="list__link list__link--card" to={doc.path}>
                  <span className="list__main">
                    <strong>{doc.title}</strong>
                    <span className="muted">{snippet}</span>
                  </span>
                  <span className="badge">{KIND_LABELS[doc.kind]}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing matches "{q}". Try fewer words.</p>
        )
      ) : (
        <>
          <ul className="list">
            {rules.articles.map((a) => (
              <li key={a.id}>
                <Link className="list__link list__link--card" to={`/rules/${a.id}`}>
                  <span className="list__main">
                    <strong>{a.title}</strong>
                    <span className="muted">{a.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <h2>More</h2>
          <ul className="list">
            {MORE.map((m) => (
              <li key={m.to}>
                <Link className="list__link list__link--card" to={m.to}>
                  <span className="list__main">
                    <strong>{m.title}</strong>
                    <span className="muted">{m.blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
