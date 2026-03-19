import './GameControls.css';

interface GameControlsProps {
  onNewGame: () => void;
  paused: boolean;
  onPauseToggle: (p: boolean) => void;
  moveDelay: number;
  onMoveDelayChange: (d: number) => void;
  isBotvBot: boolean;
}

export function GameControls({
  onNewGame,
  paused,
  onPauseToggle,
  moveDelay,
  onMoveDelayChange,
  isBotvBot,
}: GameControlsProps) {
  return (
    <div className="game-controls">
      <button className="new-game-btn" onClick={onNewGame}>
        🔄 New Game
      </button>

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
