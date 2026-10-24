import { useState } from 'react';
import { getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { LoadError } from '../layout/OfflineNotice';
import { PageHeader } from '../ui/PageHeader';
import { Blocks } from './Blocks';
import { ReportButton } from './ReportButton';
import { useScrollToHash } from './RulesArticlePage';

/** The letter a term is filed under: its first letter A–Z, or # when it starts with anything else. */
export function letterOf(term: string): string {
  const c = term.trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

const letterId = (letter: string) => `letter-${letter === '#' ? 'other' : letter}`;

/** Every game term A to Z, with a filter and a jump to each letter. Term ids are the anchors lessons link to. */
export function GlossaryPage() {
  const state = useAsync(getRules, 'rules');
  const [filter, setFilter] = useState('');
  useScrollToHash(state.status === 'ready');
  const header = <PageHeader title="Glossary" back={{ to: '/rules', label: 'Rules' }} />;
  if (state.status === 'loading') return <section>{header}<p className="muted">Loading the glossary…</p></section>;
  if (state.status === 'error') return <section>{header}<LoadError error={state.error} what="the glossary" /></section>;
  const f = filter.trim().toLowerCase();
  const terms = [...state.data.glossary]
    .sort((a, b) => a.term.localeCompare(b.term))
    .filter((g) => !f || g.term.toLowerCase().includes(f) || g.text.toLowerCase().includes(f));
  const letters = [...new Set(terms.map((g) => letterOf(g.term)))];
  return (
    <section>
      {header}
      <input className="input" type="search" aria-label="Filter terms" placeholder="Filter terms" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {letters.length > 0 && (
        <nav aria-label="Jump to letter" className="rules-chips">
          {letters.map((l) => (
            <a key={l} className="chip" href={`#${letterId(l)}`}>
              {l}
            </a>
          ))}
        </nav>
      )}
      {letters.map((l) => (
        <div key={l} className="glossary__letter">
          <h2 id={letterId(l)}>{l}</h2>
          {terms
            .filter((g) => letterOf(g.term) === l)
            .map((g) => (
              <section key={g.id} className="rules-section">
                <h3 id={g.id}>{g.term}</h3>
                <Blocks blocks={g.blocks} />
              </section>
            ))}
        </div>
      ))}
      {terms.length === 0 && <p className="muted">No terms match.</p>}
      <ReportButton target={{ kind: 'glossary', name: 'Glossary' }} text="Glossary" parts={terms.map((g) => ({ name: g.term, text: g.text }))} />
    </section>
  );
}
