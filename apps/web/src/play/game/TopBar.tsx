import { totalVp, type GameState, type PlayerId } from '@recruit/engine';
import { Link } from 'react-router-dom';
import { IconBack, IconLog, IconMore, IconUndo } from '../../ui/icons';
import { armyName, whereText } from './names';
import { PhaseStrip } from './PhaseStrip';

/**
 * The game's header: Back to the Practice games, round and phase, Undo, Log and Menu; then each army's CP and VP (the
 * active army highlighted); then the phase strip.
 */
export function TopBar({ state, onUndo, onLog, onMenu, onScore }: { state: GameState; onUndo(): void; onLog(): void; onMenu(): void; onScore?(): void }) {
  return (
    <header className="game__top game__top--nav" role="banner" aria-label="Game status">
      <Link to="/play" className="btn btn--icon game__back" aria-label="Back to Practice games">
        <IconBack size={24} aria-hidden="true" />
      </Link>
      <div className="game__where">{whereText(state)}</div>
      <div className="game__tools">
        <button type="button" className="btn btn--icon" aria-label="Undo" onClick={onUndo}>
          <IconUndo size={20} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn--small game__log-btn" onClick={onLog}>
          <IconLog size={18} aria-hidden="true" />
          <span className="game__log-text">Log</span>
        </button>
        <button type="button" className="btn btn--icon" aria-label="Menu" onClick={onMenu}>
          <IconMore size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="game__armies">
        {(['A', 'B'] as PlayerId[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`game__army game__army--${p}`}
            data-player={p}
            data-active={state.phase !== 'pre-battle' && state.active === p ? 'true' : 'false'}
            onClick={onScore}
          >
            <span className="game__army-name">{armyName(state, p)}</span>
            <span className="game__army-nums">
              <span>CP {state.cp[p]}</span> <span>VP {totalVp(state, p)}</span>
            </span>
          </button>
        ))}
      </div>
      <PhaseStrip phase={state.phase} />
    </header>
  );
}
