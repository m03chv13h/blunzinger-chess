import { useState } from 'react';
import type { GameSetupConfig, GameMode, BotLevel, Color } from '../core/blunziger/types';
import './NewGameSetupScreen.css';

interface NewGameSetupScreenProps {
  initialConfig: GameSetupConfig;
  onStartGame: (config: GameSetupConfig) => void;
}

export function NewGameSetupScreen({ initialConfig, onStartGame }: NewGameSetupScreenProps) {
  const [config, setConfig] = useState<GameSetupConfig>(initialConfig);

  const update = (patch: Partial<GameSetupConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const handleStart = () => {
    onStartGame(config);
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h2>♟ New Game Setup</h2>

        <div className="setup-group">
          <label htmlFor="mode-select">Game Mode</label>
          <select
            id="mode-select"
            value={config.mode}
            onChange={(e) => update({ mode: e.target.value as GameMode })}
          >
            <option value="hvh">Human vs Human</option>
            <option value="hvbot">Human vs Bot</option>
            <option value="botvbot">Bot vs Bot</option>
          </select>
        </div>

        {(config.mode === 'hvbot' || config.mode === 'botvbot') && (
          <div className="setup-group">
            <label htmlFor="bot-level-select">Bot Difficulty</label>
            <select
              id="bot-level-select"
              value={config.botDifficulty}
              onChange={(e) => update({ botDifficulty: e.target.value as BotLevel })}
            >
              <option value="easy">Easy (Random)</option>
              <option value="medium">Medium (Heuristic)</option>
              <option value="hard">Hard (Minimax)</option>
            </select>
          </div>
        )}

        {config.mode === 'hvbot' && (
          <div className="setup-group">
            <label htmlFor="play-as-select">Play As</label>
            <select
              id="play-as-select"
              value={config.botSide === 'b' ? 'w' : 'b'}
              onChange={(e) => update({ botSide: (e.target.value === 'w' ? 'b' : 'w') as Color })}
            >
              <option value="w">White</option>
              <option value="b">Black</option>
            </select>
          </div>
        )}

        <div className="setup-group">
          <label htmlFor="threshold-input">Invalid Report Loss Threshold</label>
          <input
            id="threshold-input"
            type="number"
            min={1}
            max={10}
            value={config.invalidReportLossThreshold}
            onChange={(e) =>
              update({ invalidReportLossThreshold: Math.max(1, parseInt(e.target.value) || 2) })
            }
          />
        </div>

        <div className="setup-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.enableKingOfTheHill}
              onChange={(e) => update({ enableKingOfTheHill: e.target.checked })}
            />
            Enable King of the Hill
          </label>
        </div>

        <button className="start-game-btn" onClick={handleStart}>
          ▶ Start Game
        </button>
      </div>
    </div>
  );
}
