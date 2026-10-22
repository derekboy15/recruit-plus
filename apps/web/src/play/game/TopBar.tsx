import { totalVp, type GameState, type PlayerId } from '@recruit/engine';
import { armyName, whereText } from './names';

/** Round and phase, each army's CP and VP (the active army highlighted), and the Undo, Log and Menu buttons. */
export function TopBar({ state, onUndo, onLog, onMenu, onScore }: { state: GameState; onUndo(): void; onLog(): void; onMenu(): void; onScore?(): void }) {
  return (
    <header className="game__top" role="banner" aria-label="Game status">
      <div className="game__where">{whereText(state)}</div>
      <div className="game__armies">
        {(['A', 'B'] as PlayerId[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`game__army game__army--${p}`}
            data-player={p}
            data-active={state.phase !== 'pre-battle' && state.active === p ? 'true' : 'false'}
            onClick={onScore}
            aria-label={`${armyName(state, p)}: ${state.cp[p]} CP, ${totalVp(state, p)} VP`}
          >
            <span className="game__army-name">{armyName(state, p)}</span>
            <span className="game__army-nums">
              <span>CP {state.cp[p]}</span> <span>VP {totalVp(state, p)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="game__tools">
        <button type="button" className="btn btn--small" onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="btn btn--small" onClick={onLog}>
          Log
        </button>
        <button type="button" className="btn btn--small" onClick={onMenu}>
          Menu
        </button>
      </div>
    </header>
  );
}
