import { Link } from 'react-router-dom';

export function Home() {
  return (
    <section>
      <h1>Learn, build and play Warhammer 40,000 — 9th Edition</h1>
      <p>
        Recruit+ takes you from never having played to running real games: short hands-on lessons, an army builder
        that explains itself, an on-screen practice board, and a turn-by-turn companion for the tabletop.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        <Link className="btn btn--primary" to="/sign-in">
          Sign in to start
        </Link>
        <Link className="btn" to="/factions">
          Browse factions
        </Link>
      </div>
      <ul className="list">
        <li className="card"><strong>Learn</strong> — the core rules, one phase at a time.</li>
        <li className="card"><strong>Build</strong> — legal lists for every 9th Edition faction, with plain-English help.</li>
        <li className="card"><strong>Play</strong> — practise on screen, two players on one device.</li>
        <li className="card"><strong>Table</strong> — run a real game step by step: CP, VP, missions, stratagems.</li>
      </ul>
    </section>
  );
}
