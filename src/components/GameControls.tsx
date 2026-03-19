import { useState } from 'react';
import type { GameMode, BotLevel, Color, BlunzigerConfig } from '../core/blunziger/types';
import { DEFAULT_CONFIG } from '../core/blunziger/types';
import './GameControls.css';

interface GameControlsProps {
  currentMode: GameMode;
  currentConfig: BlunzigerConfig;
  currentBotLevel: BotLevel;
  currentBotColor: Color;
  onNewGame: (mode: GameMode, config: BlunzigerConfig, botLevel: BotLevel, botColor: Color) => void;
  paused: boolean;
  onPauseToggle: (p: boolean) => void;
  moveDelay: number;
  onMoveDelayChange: (d: number) => void;
  isBotvBot: boolean;
}

export function GameControls({
  currentMode,
  currentConfig,
  currentBotLevel,
  currentBotColor,
  onNewGame,
  paused,
  onPauseToggle,
  moveDelay,
  onMoveDelayChange,
  isBotvBot,
}: GameControlsProps) {
  const [mode, setMode] = useState<GameMode>(currentMode);
  const [botLevel, setBotLevel] = useState<BotLevel>(currentBotLevel);
  const [botColor, setBotColor] = useState<Color>(currentBotColor);
  const [threshold, setThreshold] = useState<number>(currentConfig.invalidReportLossThreshold);
  const [enableKoth, setEnableKoth] = useState<boolean>(currentConfig.enableKingOfTheHill);

  const handleStart = () => {
    onNewGame(mode, { ...DEFAULT_CONFIG, invalidReportLossThreshold: threshold, enableKingOfTheHill: enableKoth }, botLevel, botColor);
  };

  return (
    <div className="game-controls">
      <h3>Game Settings</h3>

      <div className="control-group">
        <label>Mode:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
          <option value="hvh">Human vs Human</option>
          <option value="hvbot">Human vs Bot</option>
          <option value="botvbot">Bot vs Bot</option>
        </select>
      </div>

      {(mode === 'hvbot' || mode === 'botvbot') && (
        <div className="control-group">
          <label>Bot Level:</label>
          <select value={botLevel} onChange={(e) => setBotLevel(e.target.value as BotLevel)}>
            <option value="easy">Easy (Random)</option>
            <option value="medium">Medium (Heuristic)</option>
            <option value="hard">Hard (Minimax)</option>
          </select>
        </div>
      )}

      {mode === 'hvbot' && (
        <div className="control-group">
          <label>Play as:</label>
          <select value={botColor === 'b' ? 'w' : 'b'} onChange={(e) => setBotColor(e.target.value === 'w' ? 'b' : 'w')}>
            <option value="w">White</option>
            <option value="b">Black</option>
          </select>
        </div>
      )}

      <div className="control-group">
        <label>Invalid report threshold:</label>
        <input
          type="number"
          min={1}
          max={10}
          value={threshold}
          onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 2))}
        />
      </div>

      <div className="control-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={enableKoth}
            onChange={(e) => setEnableKoth(e.target.checked)}
          />
          Enable King of the Hill
        </label>
      </div>

      <button className="new-game-btn" onClick={handleStart}>
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
