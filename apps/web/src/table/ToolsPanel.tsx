import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCoreStratagems, getRules } from '../factions/dataClient';
import { useAsync } from '../factions/useAsync';
import { search, searchDocs } from '../rules/search';
import { DiceRoller } from './DiceRoller';
import type { Pos, TableEvent } from './game';
import { OddsCalculator } from './OddsCalculator';

const TOOLS = ['Dice', 'Attack odds', 'Rules search'] as const;

/** Dice, the attack-odds calculator and a rules search, all a tap away during a game. */
export function ToolsPanel({ pos, roll, append }: { pos: Pos | null; roll: (sides: 3 | 6) => number; append: (events: TableEvent[]) => Promise<void> }) {
  const [tool, setTool] = useState<(typeof TOOLS)[number]>('Dice');
  return (
    <div className="tools">
      <div className="seg" role="tablist" aria-label="Tools">
        {TOOLS.map((t) => (
          <button key={t} type="button" role="tab" className="seg__btn" aria-selected={tool === t} onClick={() => setTool(t)}>{t}</button>
        ))}
      </div>
      {tool === 'Dice' && <DiceRoller pos={pos} roll={roll} append={append} />}
      {tool === 'Attack odds' && <OddsCalculator />}
      {tool === 'Rules search' && <RulesSearch />}
    </div>
  );
}

function RulesSearch() {
  const state = useAsync(() => Promise.all([getRules(), getCoreStratagems()]), 'rules');
  const [query, setQuery] = useState('');
  const docs = useMemo(() => (state.status === 'ready' ? searchDocs(...state.data) : []), [state]);
  const hits = useMemo(() => search(docs, query, 10), [docs, query]);
  if (state.status === 'loading') return <p className="muted">Loading the rules…</p>;
  if (state.status === 'error') return <p role="alert">Couldn’t load the rules: {state.error.message}</p>;
  const q = query.trim();
  return (
    <div>
      <input className="input" type="search" aria-label="Search the rules" placeholder='Try "overwatch" or "objective secured"' value={query} onChange={(e) => setQuery(e.target.value)} />
      {q && (hits.length ? (
        <ul className="list" aria-label="Search results" style={{ marginTop: '0.75rem' }}>
          {hits.map(({ doc, snippet }) => (
            <li key={doc.id}>
              <Link className="list__link list__link--card" to={doc.path}>
                <span className="list__main"><strong>{doc.title}</strong><span className="muted">{snippet}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="muted">Nothing matches "{q}". Try fewer words.</p>)}
    </div>
  );
}
