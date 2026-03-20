import { useState } from 'react';
import type { GameSetupConfig, GameMode, BotLevel, Color, VariantModeId } from '../core/blunziger/types';
import { GAME_MODE_DEFINITIONS, getGameModeDefinition } from '../core/blunziger/types';
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
      moveLimit: def.config.moveLimit,
    });
  };

  const handleStart = () => {
    onStartGame(config);
  };

  const activeDef = getGameModeDefinition(config.variantModeId);
  const showClock = config.enableClock;
  const showMoveLimit = activeDef.config.moveLimit > 0;
  // Show threshold when Blunziger is enabled, not reverse, and no penalties are checked (report-based)
  const hasAnyPenalty = config.enableExtraMovePenalty || config.enablePieceRemovalPenalty || config.enableTimeReductionPenalty;
  const showThreshold = activeDef.config.enableBlunziger && !activeDef.config.reverseForcedCheck && !hasAnyPenalty;
  // Penalty checkboxes shown when Blunziger forced-check rule is active (not reverse)
  const showPenalties = activeDef.config.enableBlunziger && !activeDef.config.reverseForcedCheck;
  const showTimeReductionSeconds = config.enableTimeReductionPenalty && showClock;

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

        {/* ── King of the Hill ── */}
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

        {/* ── Clock ── */}
        <div className="setup-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={config.enableClock}
              onChange={(e) => update({ enableClock: e.target.checked })}
            />
            Enable Clock
          </label>
        </div>

        {showClock && (
          <div className="setup-group">
            <label htmlFor="time-control-input">Initial time (minutes)</label>
            <NumericInput
              id="time-control-input"
              value={Math.round(config.initialTimeMs / 60000)}
              onChange={(v) => update({ initialTimeMs: v * 60000 })}
              min={1}
              max={60}
              fallback={5}
            />
          </div>
        )}

        {/* ── Penalty Checkboxes ── */}
        {showPenalties && (
          <fieldset className="setup-group penalty-group">
            <legend>Penalties on missed forced check</legend>
            <label>
              <input
                type="checkbox"
                checked={config.enableExtraMovePenalty}
                onChange={(e) => update({ enableExtraMovePenalty: e.target.checked })}
              />
              Additional move
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.enablePieceRemovalPenalty}
                onChange={(e) => update({ enablePieceRemovalPenalty: e.target.checked })}
              />
              Piece removal
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.enableTimeReductionPenalty}
                disabled={!config.enableClock}
                onChange={(e) => update({ enableTimeReductionPenalty: e.target.checked })}
              />
              Time reduction
            </label>

            {showTimeReductionSeconds && (
              <div className="setup-group">
                <label htmlFor="time-reduction-input">Time reduction (seconds)</label>
                <NumericInput
                  id="time-reduction-input"
                  value={config.timeReductionSeconds}
                  onChange={(v) => update({ timeReductionSeconds: v })}
                  min={1}
                  max={60}
                  fallback={5}
                />
              </div>
            )}
          </fieldset>
        )}

        <button className="start-game-btn" onClick={handleStart}>
          ▶ Start Game
        </button>
      </div>
    </div>
  );
}
