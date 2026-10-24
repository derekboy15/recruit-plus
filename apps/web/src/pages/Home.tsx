import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { FactionBadge } from '../ui/FactionBadge';
import { IconCheck, IconLearn, IconLists, IconPlay, IconPractice, IconRules, IconTable, IconWarning, type LucideIcon } from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { relativeTime } from '../ui/relativeTime';
import { useHomeData, useNextLesson, type HomeGame, type HomeList } from './homeData';
import './pages.css';

const FEATURES: { to: string; title: string; blurb: string; Icon: LucideIcon }[] = [
  { to: '/learn', title: 'Learn', blurb: 'The core rules, one phase at a time.', Icon: IconLearn },
  { to: '/build', title: 'Lists', blurb: 'Legal lists for every 9th Edition faction, with plain-English help.', Icon: IconLists },
  { to: '/play', title: 'Practice', blurb: 'Play on screen, two players on one device.', Icon: IconPractice },
  { to: '/table', title: 'Table', blurb: 'Run a real game step by step: CP, VP, missions, stratagems.', Icon: IconTable },
  { to: '/rules', title: 'Rules', blurb: 'Search the core rules, glossary and every faction’s datasheets.', Icon: IconRules },
];

/** Signed out: what Recruit+ is, and a way in. */
function Landing() {
  return (
    <section className="home-hero">
      <h1>Learn, build and play Warhammer 40,000 — 9th Edition</h1>
      <p className="home-hero__lead">
        Recruit+ takes you from never having played to running real games: short hands-on lessons, an army builder
        that explains itself, an on-screen practice board, and a turn-by-turn companion for the tabletop.
      </p>
      <div className="home-hero__actions">
        <Link className="btn btn--primary" to="/sign-in">
          Sign in to start
        </Link>
      </div>
      <ul className="home-cards">
        {FEATURES.map(({ to, title, blurb, Icon }) => (
          <li key={to}>
            <Link className="home-card" to={to}>
              <Icon size={22} aria-hidden="true" />
              <span className="home-card__title">{title}</span>
              <span className="home-card__blurb">{blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The next lesson, or the first game once every lesson is done. Never stuck loading: a failure still links to Learn. */
function ContinueLearning() {
  const next = useNextLesson();
  return (
    <section className="home-section card home-learn" aria-labelledby="home-learn">
      <h2 id="home-learn">Continue learning</h2>
      {next.status === 'loading' && <p className="muted">Loading the lessons…</p>}
      {next.status === 'error' && (
        <>
          <p className="muted">Short lessons, each with a drill on a real battlefield.</p>
          <Link className="btn btn--primary" to="/learn">
            Go to Learn
          </Link>
        </>
      )}
      {next.status === 'next' && (
        <>
          <p className="muted">
            {next.order === 1 ? `${next.total} short lessons, each with a drill.` : `Lesson ${next.order} of ${next.total} is next.`}
          </p>
          <Link className="btn btn--primary home-learn__next" to={`/learn/${next.id}`}>
            <IconPlay size={18} aria-hidden="true" />
            {`Lesson ${next.order}: ${next.title}`}
          </Link>
        </>
      )}
      {next.status === 'done' && (
        <>
          <p className="muted">You’ve finished all {next.total} lessons. Try a 500-point game with hints on.</p>
          <Link className="btn btn--primary home-learn__next" to="/learn/first-game">
            <IconPlay size={18} aria-hidden="true" />
            Play your first game
          </Link>
        </>
      )}
      {next.status !== 'error' && (
        <Link className="btn btn--tertiary home-learn__all" to="/learn">
          All lessons
        </Link>
      )}
    </section>
  );
}

function ListRow({ list }: { list: HomeList }) {
  return (
    <li className="home-row">
      <FactionBadge slug={list.slug} name={list.faction} />
      <div className="home-row__main">
        <Link className="home-row__name" to={`/build/${list.id}`}>
          {list.name}
        </Link>
        <span className="home-row__meta">{`${list.faction} · ${list.size} · ${list.points.toLocaleString('en-GB')} / ${list.pointsLimit.toLocaleString('en-GB')} pts`}</span>
        <span className="home-row__meta">
          {list.issueCount > 0 ? (
            <span className="home-row__warn">
              <IconWarning size={13} aria-hidden="true" /> {list.issueCount} to fix
            </span>
          ) : (
            <span className="home-row__ok">
              <IconCheck size={13} aria-hidden="true" /> Legal
            </span>
          )}
          {` · edited ${relativeTime(list.updatedAt)}`}
        </span>
      </div>
      <Link className="btn home-row__action" to={`/build/${list.id}/play`} aria-label={`Play ${list.name}`}>
        <IconPlay size={18} aria-hidden="true" />
        <span className="home-row__action-label">Play</span>
      </Link>
    </li>
  );
}

function GameRow({ game }: { game: HomeGame }) {
  return (
    <li className="home-row">
      <div className="home-row__main">
        <Link className="home-row__name" to={game.to}>
          {game.title}
        </Link>
        <span className="home-row__meta">{`${game.kind === 'practice' ? 'Practice' : 'Table'} · ${game.status}`}</span>
        <span className="home-row__meta">{`Played ${relativeTime(game.updatedAt)}`}</span>
      </div>
    </li>
  );
}

/** Signed in: pick up where you left off. */
function Dashboard() {
  const { lists, games, loading } = useHomeData();
  return (
    <>
      <PageHeader variant="top" title="Welcome back" />
      <ContinueLearning />
      <section className="home-section" aria-labelledby="home-lists">
        <div className="home-section__head">
          <h2 id="home-lists">Your lists</h2>
          {lists.length > 0 && (
            <Link className="btn btn--tertiary" to="/build">
              All lists
            </Link>
          )}
        </div>
        {loading ? (
          <p className="muted">Loading your lists…</p>
        ) : lists.length === 0 ? (
          <div className="card home-empty">
            <p>No lists yet. Pick a faction and the builder checks every rule for you.</p>
            <Link className="btn" to="/build/new">
              Build your first army
            </Link>
          </div>
        ) : (
          <>
            <ul className="home-rows">
              {lists.slice(0, 3).map((l) => (
                <ListRow key={l.id} list={l} />
              ))}
            </ul>
            <Link className="btn home-section__more" to="/build/new">
              New list
            </Link>
          </>
        )}
      </section>
      {games.length > 0 && (
        <section className="home-section" aria-labelledby="home-games">
          <h2 id="home-games">Games in progress</h2>
          <ul className="home-rows">
            {games.slice(0, 3).map((g) => (
              <GameRow key={g.id} game={g} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function Home() {
  const { user } = useAuth();
  return user ? <Dashboard /> : <Landing />;
}
