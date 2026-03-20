import { useState } from 'react';
import type { GameSetupConfig, GameMode, BotLevel, Color, VariantModeId } from '../core/blunziger/types';
import { GAME_MODE_DEFINITIONS, getGameModeDefinition, DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import { NumericInput } from './NumericInput';
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
        def.config.missedCheckPenalty !== 'loss'
          ? DEFAULT_SETUP_CONFIG.missedCheckTimePenaltySeconds
          : 0,
    });
  };

  const handleStart = () => {
    onStartGame(config);
  };

  const activeDef = getGameModeDefinition(config.variantModeId);
  const showClock = activeDef.config.enableClock || config.enableClock;
  const showMoveLimit = activeDef.config.moveLimit > 0;
  const showThreshold = activeDef.config.enableBlunziger && activeDef.config.missedCheckPenalty === 'loss';
  const showTimePenalty = activeDef.config.missedCheckPenalty !== 'loss' && showClock;
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
            <NumericInput
              id="threshold-input"
              value={config.invalidReportLossThreshold}
              onChange={(v) => update({ invalidReportLossThreshold: v })}
              min={1}
              max={10}
              fallback={2}
            />
          </div>
        )}

        {showClock && (
          <>
            <div className="setup-group">
              <label htmlFor="time-control-input">Time per side (minutes)</label>
              <NumericInput
                id="time-control-input"
                value={Math.round(config.initialTimeMs / 60000)}
                onChange={(v) => update({ initialTimeMs: v * 60000 })}
                min={1}
                max={60}
                fallback={5}
              />
            </div>
            <div className="setup-group">
              <label htmlFor="increment-input">Increment (seconds)</label>
              <NumericInput
                id="increment-input"
                value={Math.round(config.incrementMs / 1000)}
                onChange={(v) => update({ incrementMs: v * 1000 })}
                min={0}
                max={30}
                fallback={0}
              />
            </div>
          </>
        )}

        {showTimePenalty && (
          <div className="setup-group">
            <label htmlFor="time-penalty-input">Missed check time penalty (seconds)</label>
            <NumericInput
              id="time-penalty-input"
              value={config.missedCheckTimePenaltySeconds}
              onChange={(v) => update({ missedCheckTimePenaltySeconds: v })}
              min={0}
              max={60}
              fallback={0}
            />
          </div>
        )}

        {showMoveLimit && (
          <div className="setup-group">
            <label htmlFor="movelimit-input">Move Limit (full moves)</label>
            <NumericInput
              id="movelimit-input"
              value={config.moveLimit}
              onChange={(v) => update({ moveLimit: v })}
              min={5}
              max={200}
              fallback={40}
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

        {/* ── Blitz (Clock Overlay) ── */}
        <div className="setup-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.enableClock || activeDef.config.enableClock}
              disabled={activeDef.config.enableClock}
              onChange={(e) => update({ enableClock: e.target.checked })}
            />
            Enable Blitz (Chess Clocks)
          </label>
        </div>

        <button className="start-game-btn" onClick={handleStart}>
          ▶ Start Game
        </button>
      </div>
    </div>
  );
}
