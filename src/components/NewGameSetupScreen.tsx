import { useState } from 'react';
import type { GameSetupConfig, GameMode, BotLevel, Color, VariantModeId } from '../core/blunziger/types';
import { GAME_MODE_DEFINITIONS, getGameModeDefinition } from '../core/blunziger/types';
import './NewGameSetupScreen.css';

interface NewGameSetupScreenProps {
  initialConfig: GameSetupConfig;
  onStartGame: (config: GameSetupConfig) => void;
}

export function NewGameSetupScreen({ initialConfig, onStartGame }: NewGameSetupScreenProps) {
  const [config, setConfig] = useState<GameSetupConfig>(initialConfig);

  const update = (patch: Partial<GameSetupConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const handleModeChange = (id: VariantModeId) => {
    const def = getGameModeDefinition(id);
    update({
      variantModeId: id,
      // Carry forward mode-specific defaults from preset
      invalidReportLossThreshold: def.config.invalidReportLossThreshold,
      initialTimeMs: def.config.initialTimeMs,
      incrementMs: def.config.incrementMs,
      moveLimit: def.config.moveLimit,
      missedCheckTimePenaltySeconds:
        def.config.missedCheckPenalty === 'extra_move' && def.config.enableClock ? 5 : 0,
    });
  };

  const handleStart = () => {
    onStartGame(config);
  };

  const activeDef = getGameModeDefinition(config.variantModeId);
  const showClock = activeDef.config.enableClock;
  const showMoveLimit = activeDef.config.moveLimit > 0;
  const showThreshold = activeDef.config.enableBlunziger && activeDef.config.missedCheckPenalty === 'loss';
  const showTimePenalty = activeDef.config.missedCheckPenalty === 'extra_move' && activeDef.config.enableClock;
  // KOTH can combine with any mode except those where it materially conflicts
  const showKoth = true;

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h2>♟ New Game Setup</h2>

        {/* ── Variant Mode ── */}
        <div className="setup-group">
          <label htmlFor="variant-mode-select">Variant Mode</label>
          <select
            id="variant-mode-select"
            value={config.variantModeId}
            onChange={(e) => handleModeChange(e.target.value as VariantModeId)}
          >
            {GAME_MODE_DEFINITIONS.map((def) => (
              <option key={def.id} value={def.id}>
                {def.name}
              </option>
            ))}
          </select>
          <p className="mode-description">{activeDef.description}</p>
        </div>

        {/* ── Player Mode ── */}
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

        {/* ── Mode-specific options ── */}
        {showThreshold && (
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
        )}

        {showClock && (
          <>
            <div className="setup-group">
              <label htmlFor="time-control-input">Time per side (minutes)</label>
              <input
                id="time-control-input"
                type="number"
                min={1}
                max={60}
                value={Math.round(config.initialTimeMs / 60000)}
                onChange={(e) =>
                  update({ initialTimeMs: Math.max(1, parseInt(e.target.value) || 5) * 60000 })
                }
              />
            </div>
            <div className="setup-group">
              <label htmlFor="increment-input">Increment (seconds)</label>
              <input
                id="increment-input"
                type="number"
                min={0}
                max={30}
                value={Math.round(config.incrementMs / 1000)}
                onChange={(e) =>
                  update({ incrementMs: Math.max(0, parseInt(e.target.value) || 0) * 1000 })
                }
              />
            </div>
          </>
        )}

        {showTimePenalty && (
          <div className="setup-group">
            <label htmlFor="time-penalty-input">Missed check time penalty (seconds)</label>
            <input
              id="time-penalty-input"
              type="number"
              min={0}
              max={60}
              value={config.missedCheckTimePenaltySeconds}
              onChange={(e) =>
                update({ missedCheckTimePenaltySeconds: Math.max(0, parseInt(e.target.value) || 0) })
              }
            />
          </div>
        )}

        {showMoveLimit && (
          <div className="setup-group">
            <label htmlFor="movelimit-input">Move Limit (full moves)</label>
            <input
              id="movelimit-input"
              type="number"
              min={5}
              max={200}
              value={config.moveLimit}
              onChange={(e) =>
                update({ moveLimit: Math.max(5, parseInt(e.target.value) || 40) })
              }
            />
          </div>
        )}

        {showKoth && (
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
        )}

        <button className="start-game-btn" onClick={handleStart}>
          ▶ Start Game
        </button>
      </div>
    </div>
  );
}
