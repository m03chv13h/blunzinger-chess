import { useState } from 'react';
import type { GameSetupConfig, GameMode, BotLevel, Color, VariantMode, GameType } from '../core/blunziger/types';
import { VARIANT_MODE_DEFINITIONS, getVariantModeDefinition } from '../core/blunziger/types';
import type { EngineId } from '../core/engine/types';
import { getAllEngineInfos } from '../core/engine/engineRegistry';
import { NumericInput } from './NumericInput';
import { TimeInput } from './TimeInput';
import './NewGameSetupScreen.css';

interface NewGameSetupScreenProps {
  initialConfig: GameSetupConfig;
  onStartGame: (config: GameSetupConfig) => void;
}

export function NewGameSetupScreen({ initialConfig, onStartGame }: NewGameSetupScreenProps) {
  const [config, setConfig] = useState<GameSetupConfig>(initialConfig);

  const update = (patch: Partial<GameSetupConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const handleVariantModeChange = (id: VariantMode) => {
    update({ variantMode: id });
  };

  const handleGameTypeChange = (gt: GameType) => {
    update({ gameType: gt });
  };

  const handleStart = () => {
    onStartGame(config);
  };

  const activeDef = getVariantModeDefinition(config.variantMode);
  const isKingHuntMoveLimit = config.variantMode === 'classic_king_hunt_move_limit';
  const isKingHuntCheckLimit = config.variantMode === 'classic_king_hunt_given_check_limit';
  const isReportMode = config.gameType === 'report_incorrectness';
  const isPenaltyMode = config.gameType === 'penalty_on_miss';
  const showClock = config.enableClock;
  const showTimeReductionValue = config.enableTimeReductionPenalty && showClock;

  const engineInfos = getAllEngineInfos();
  const showEngineSelection = config.mode === 'hvbot' || config.mode === 'botvbot';
  const showPerSideEngines = config.mode === 'botvbot';

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h2>♟ New Game Setup</h2>

        {/* ── Variant Mode ── */}
        <div className="setup-group">
          <label htmlFor="variant-mode-select">Variant Mode</label>
          <select
            id="variant-mode-select"
            value={config.variantMode}
            onChange={(e) => handleVariantModeChange(e.target.value as VariantMode)}
          >
            {VARIANT_MODE_DEFINITIONS.map((def) => (
              <option key={def.id} value={def.id}>
                {def.name}
              </option>
            ))}
          </select>
          <p className="mode-description">{activeDef.description}</p>
        </div>

        {/* ── Game Type ── */}
        <div className="setup-group">
          <label htmlFor="game-type-select">Game Type</label>
          <select
            id="game-type-select"
            value={config.gameType}
            onChange={(e) => handleGameTypeChange(e.target.value as GameType)}
          >
            <option value="report_incorrectness">Report Incorrectness</option>
            <option value="penalty_on_miss">Penalty on Miss</option>
          </select>
        </div>

        {/* ── Player Mode ── */}
        <div className="setup-group">
          <label htmlFor="mode-select">Player Mode</label>
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

        {/* ── Engine Selection ── */}
        {showEngineSelection && !showPerSideEngines && (
          <div className="setup-group">
            <label htmlFor="engine-select">Engine</label>
            <select
              id="engine-select"
              value={config.engineId}
              onChange={(e) => {
                const id = e.target.value as EngineId;
                update({ engineId: id, engineIdWhite: id, engineIdBlack: id });
              }}
            >
              {engineInfos.map((info) => (
                <option
                  key={info.id}
                  value={info.id}
                  disabled={info.availability !== 'available'}
                >
                  {info.name}{info.availability === 'coming_soon' ? ' (coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {showPerSideEngines && (
          <>
            <div className="setup-group">
              <label htmlFor="engine-white-select">Engine (White)</label>
              <select
                id="engine-white-select"
                value={config.engineIdWhite}
                onChange={(e) => update({ engineIdWhite: e.target.value as EngineId })}
              >
                {engineInfos.map((info) => (
                  <option
                    key={info.id}
                    value={info.id}
                    disabled={info.availability !== 'available'}
                  >
                    {info.name}{info.availability === 'coming_soon' ? ' (coming soon)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="setup-group">
              <label htmlFor="engine-black-select">Engine (Black)</label>
              <select
                id="engine-black-select"
                value={config.engineIdBlack}
                onChange={(e) => update({ engineIdBlack: e.target.value as EngineId })}
              >
                {engineInfos.map((info) => (
                  <option
                    key={info.id}
                    value={info.id}
                    disabled={info.availability !== 'available'}
                  >
                    {info.name}{info.availability === 'coming_soon' ? ' (coming soon)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* ── Variant-Specific Config ── */}
        {isKingHuntMoveLimit && (
          <div className="setup-group">
            <label htmlFor="ply-limit-input">Ply Limit</label>
            <NumericInput
              id="ply-limit-input"
              value={config.kingHuntPlyLimit}
              onChange={(v) => update({ kingHuntPlyLimit: v })}
              min={10}
              max={400}
              fallback={80}
            />
          </div>
        )}

        {isKingHuntCheckLimit && (
          <div className="setup-group">
            <label htmlFor="check-target-input">Given Check Target</label>
            <NumericInput
              id="check-target-input"
              value={config.kingHuntGivenCheckTarget}
              onChange={(v) => update({ kingHuntGivenCheckTarget: v })}
              min={1}
              max={100}
              fallback={5}
            />
          </div>
        )}

        {/* ── Game-Type-Specific Config ── */}
        {isReportMode && (
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

        {isPenaltyMode && (
          <fieldset className="setup-group penalty-group">
            <legend>Penalties on missed move</legend>
            <label>
              <input
                type="checkbox"
                checked={config.enableAdditionalMovePenalty}
                onChange={(e) => update({ enableAdditionalMovePenalty: e.target.checked })}
              />
              Additional move
            </label>
            {config.enableAdditionalMovePenalty && (
              <div className="setup-group">
                <label htmlFor="extra-move-count-input">Additional move count</label>
                <NumericInput
                  id="extra-move-count-input"
                  value={config.additionalMoveCount}
                  onChange={(v) => update({ additionalMoveCount: v })}
                  min={1}
                  max={5}
                  fallback={1}
                />
              </div>
            )}
            <label>
              <input
                type="checkbox"
                checked={config.enablePieceRemovalPenalty}
                onChange={(e) => update({ enablePieceRemovalPenalty: e.target.checked })}
              />
              Piece removal
            </label>
            {config.enablePieceRemovalPenalty && (
              <div className="setup-group">
                <label htmlFor="piece-removal-count-input">Piece removal count</label>
                <NumericInput
                  id="piece-removal-count-input"
                  value={config.pieceRemovalCount}
                  onChange={(v) => update({ pieceRemovalCount: v })}
                  min={1}
                  max={5}
                  fallback={1}
                />
              </div>
            )}
            <label>
              <input
                type="checkbox"
                checked={config.enableTimeReductionPenalty}
                disabled={!config.enableClock}
                onChange={(e) => update({ enableTimeReductionPenalty: e.target.checked })}
              />
              Time reduction
            </label>
            {showTimeReductionValue && (
              <div className="setup-group">
                <label htmlFor="time-reduction-input">Time reduction (seconds)</label>
                <NumericInput
                  id="time-reduction-input"
                  value={config.timeReductionSeconds}
                  onChange={(v) => update({ timeReductionSeconds: v })}
                  min={1}
                  max={300}
                  fallback={60}
                />
              </div>
            )}
          </fieldset>
        )}

        {/* ── Overlays / Options ── */}
        <fieldset className="setup-group">
          <legend>Overlays / Options</legend>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.enableKingOfTheHill}
                onChange={(e) => update({ enableKingOfTheHill: e.target.checked })}
              />
              King of the Hill
            </label>
          </div>

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.enableClock}
                onChange={(e) => update({ enableClock: e.target.checked })}
              />
              Clock
            </label>
          </div>

          {showClock && (
            <div className="setup-group">
              <label htmlFor="time-control-input">Initial time (MM:SS)</label>
              <TimeInput
                id="time-control-input"
                valueMs={config.initialTimeMs}
                onChange={(ms) => update({ initialTimeMs: ms })}
                minSeconds={10}
                maxSeconds={3600}
                fallbackMs={5 * 60 * 1000}
              />
            </div>
          )}

          {showClock && (
            <div className="setup-group">
              <label htmlFor="increment-input">Increment per move (MM:SS)</label>
              <TimeInput
                id="increment-input"
                valueMs={config.incrementMs}
                onChange={(ms) => update({ incrementMs: ms })}
                minSeconds={0}
                maxSeconds={600}
                fallbackMs={0}
              />
            </div>
          )}

          {showClock && (
            <div className="setup-group">
              <label htmlFor="decrement-input">Decrement per move (MM:SS)</label>
              <TimeInput
                id="decrement-input"
                valueMs={config.decrementMs}
                onChange={(ms) => update({ decrementMs: ms })}
                minSeconds={0}
                maxSeconds={600}
                fallbackMs={0}
              />
            </div>
          )}

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.enableDoubleCheckPressure}
                onChange={(e) => update({ enableDoubleCheckPressure: e.target.checked })}
              />
              Double Check Pressure
            </label>
          </div>
        </fieldset>

        <button className="start-game-btn" onClick={handleStart}>
          ▶ Start Game
        </button>
      </div>
    </div>
  );
}
