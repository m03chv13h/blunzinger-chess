import './GameControls.css';

interface GameControlsProps {
  onNewGame: () => void;
  onRestart: () => void;
  paused: boolean;
  onPauseToggle: (p: boolean) => void;
  moveDelay: number;
  onMoveDelayChange: (d: number) => void;
  isBotvBot: boolean;
  showEvalBar: boolean;
  onShowEvalBarChange: (v: boolean) => void;
}

export function GameControls({
  onNewGame,
  onRestart,
  paused,
  onPauseToggle,
  moveDelay,
  onMoveDelayChange,
  isBotvBot,
  showEvalBar,
  onShowEvalBarChange,
}: GameControlsProps) {
  return (
    <div className="game-controls">
      <button className="new-game-btn" onClick={onNewGame}>
        🔄 New Game
      </button>
      <button className="restart-btn" onClick={onRestart}>
        🔁 Restart
      </button>

      <div className="control-group eval-toggle">
        <label>
          <input
            type="checkbox"
            checked={showEvalBar}
            onChange={(e) => onShowEvalBarChange(e.target.checked)}
          />{' '}
          Show evaluation bar
        </label>
      </div>

      {isBotvBot && (
        <div className="botvbot-controls">
          <button
            className={`pause-btn ${paused ? 'paused' : ''}`}
            onClick={() => onPauseToggle(!paused)}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <div className="control-group">
            <label>Move delay: {moveDelay}ms</label>
            <input
              type="range"
              min={100}
              max={3000}
              step={100}
              value={moveDelay}
              onChange={(e) => onMoveDelayChange(parseInt(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
