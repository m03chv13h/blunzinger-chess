import type { ReactNode } from 'react';
import { useState } from 'react';
import type { GameSetupConfig, VariantMode, GameType, BotLevel } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, VARIANT_MODE_DEFINITIONS, getVariantModeDefinition } from '../core/blunziger/types';
import type { EngineId, EngineInfo } from '../core/engine/types';
import { getAllEngineInfos, getEngineInfo } from '../core/engine/engineRegistry';
import { NumericInput } from './NumericInput';
import { TimeInput } from './TimeInput';
import './SimulationSection.css';

function formatEngineName(info: EngineInfo): string {
  return info.availability === 'coming_soon' ? `${info.name} (coming soon)` : info.name;
}

interface SimulationSetupScreenProps {
  onStart: (config: GameSetupConfig, count: number) => void;
  /** Optional content rendered below the setup form (e.g. simulations overview). */
  children?: ReactNode;
}

export function SimulationSetupScreen({ onStart, children }: SimulationSetupScreenProps) {
  const [config, setConfig] = useState<GameSetupConfig>({
    ...DEFAULT_SETUP_CONFIG,
    mode: 'botvbot',
    botDifficulty: 'easy',
  });
  const [gameCount, setGameCount] = useState(10);

  const update = (patch: Partial<GameSetupConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }));

  const activeDef = getVariantModeDefinition(config.variantMode);
  const isKingHuntMoveLimit = config.variantMode === 'classic_king_hunt_move_limit';
  const isKingHuntCheckLimit = config.variantMode === 'classic_king_hunt_given_check_limit';
  const isReportMode = config.gameType === 'report_incorrectness';
  const isPenaltyMode = config.gameType === 'penalty_on_miss';
  const showClock = config.enableClock;
  const showTimeReductionValue = config.enableTimeReductionPenalty && showClock;
  const engineInfos = getAllEngineInfos();

  const handleStart = () => {
    onStart(config, gameCount);
  };

  return (
    <div className="simulation-section">
      <div className="simulation-card">
        <h2>🔬 Simulation Setup</h2>
        <p className="simulation-subtitle">
          Configure and run multiple bot vs bot games automatically.
        </p>

        <div className="sim-setup-group">
          <label htmlFor="sim-game-count">Number of Games</label>
          <NumericInput
            id="sim-game-count"
            value={gameCount}
            onChange={setGameCount}
            min={1}
            max={1000}
            fallback={10}
          />
        </div>

        <div className="sim-setup-group">
          <label htmlFor="sim-bot-level-white">Bot Difficulty (White)</label>
          <select
            id="sim-bot-level-white"
            value={config.botDifficultyWhite}
            onChange={(e) => update({ botDifficultyWhite: e.target.value as BotLevel })}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="sim-setup-group">
          <label htmlFor="sim-bot-level-black">Bot Difficulty (Black)</label>
          <select
            id="sim-bot-level-black"
            value={config.botDifficultyBlack}
            onChange={(e) => update({ botDifficultyBlack: e.target.value as BotLevel })}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div className="sim-setup-group">
          <label htmlFor="sim-engine-white-select">Engine (White)</label>
          <select
            id="sim-engine-white-select"
            value={config.engineIdWhite}
            onChange={(e) => update({ engineIdWhite: e.target.value as EngineId })}
          >
            {engineInfos.map((info) => (
              <option
                key={info.id}
                value={info.id}
                disabled={info.availability !== 'available'}
              >
                {formatEngineName(info)}
              </option>
            ))}
          </select>
          <p className="sim-description">{getEngineInfo(config.engineIdWhite)?.description}</p>
        </div>

        <div className="sim-setup-group">
          <label htmlFor="sim-engine-black-select">Engine (Black)</label>
          <select
            id="sim-engine-black-select"
            value={config.engineIdBlack}
            onChange={(e) => update({ engineIdBlack: e.target.value as EngineId })}
          >
            {engineInfos.map((info) => (
              <option
                key={info.id}
                value={info.id}
                disabled={info.availability !== 'available'}
              >
                {formatEngineName(info)}
              </option>
            ))}
          </select>
          <p className="sim-description">{getEngineInfo(config.engineIdBlack)?.description}</p>
        </div>

        <div className="sim-setup-group">
          <label htmlFor="sim-variant-mode">Variant Mode</label>
          <select
            id="sim-variant-mode"
            value={config.variantMode}
            onChange={(e) => update({ variantMode: e.target.value as VariantMode })}
          >
            {VARIANT_MODE_DEFINITIONS.map((def) => (
              <option key={def.id} value={def.id}>{def.name}</option>
            ))}
          </select>
          <p className="sim-description">{activeDef.description}</p>
        </div>

        <div className="sim-setup-group">
          <label htmlFor="sim-game-type">Game Type</label>
          <select
            id="sim-game-type"
            value={config.gameType}
            onChange={(e) => update({ gameType: e.target.value as GameType })}
          >
            <option value="report_incorrectness">Report Incorrectness</option>
            <option value="penalty_on_miss">Penalty on Miss</option>
          </select>
        </div>

        {isKingHuntMoveLimit && (
          <div className="sim-setup-group">
            <label htmlFor="sim-ply-limit">Ply Limit</label>
            <NumericInput
              id="sim-ply-limit"
              value={config.kingHuntPlyLimit}
              onChange={(v) => update({ kingHuntPlyLimit: v })}
              min={10}
              max={400}
              fallback={80}
            />
          </div>
        )}

        {isKingHuntCheckLimit && (
          <div className="sim-setup-group">
            <label htmlFor="sim-check-target">Given Check Target</label>
            <NumericInput
              id="sim-check-target"
              value={config.kingHuntGivenCheckTarget}
              onChange={(v) => update({ kingHuntGivenCheckTarget: v })}
              min={1}
              max={100}
              fallback={5}
            />
          </div>
        )}

        {isReportMode && (
          <div className="sim-setup-group">
            <label htmlFor="sim-report-threshold">Invalid Report Loss Threshold</label>
            <NumericInput
              id="sim-report-threshold"
              value={config.invalidReportLossThreshold}
              onChange={(v) => update({ invalidReportLossThreshold: v })}
              min={1}
              max={10}
              fallback={2}
            />
          </div>
        )}

        {isPenaltyMode && (
          <fieldset className="sim-setup-group penalty-group">
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
              <div className="sim-setup-group">
                <label htmlFor="sim-extra-move-count">Additional move count</label>
                <NumericInput
                  id="sim-extra-move-count"
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
              <div className="sim-setup-group">
                <label htmlFor="sim-piece-removal-count">Piece removal count</label>
                <NumericInput
                  id="sim-piece-removal-count"
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
              <div className="sim-setup-group">
                <label htmlFor="sim-time-reduction">Time reduction (seconds)</label>
                <NumericInput
                  id="sim-time-reduction"
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

        <fieldset className="sim-setup-group">
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
            <div className="sim-setup-group">
              <label htmlFor="sim-initial-time">Initial time (MM:SS)</label>
              <TimeInput
                id="sim-initial-time"
                valueMs={config.initialTimeMs}
                onChange={(ms) => update({ initialTimeMs: ms })}
                minSeconds={10}
                maxSeconds={3600}
                fallbackMs={5 * 60 * 1000}
              />
            </div>
          )}

          {showClock && (
            <div className="sim-setup-group">
              <label htmlFor="sim-increment">Increment per move (MM:SS)</label>
              <TimeInput
                id="sim-increment"
                valueMs={config.incrementMs}
                onChange={(ms) => update({ incrementMs: ms })}
                minSeconds={0}
                maxSeconds={600}
                fallbackMs={0}
              />
            </div>
          )}

          {showClock && (
            <div className="sim-setup-group">
              <label htmlFor="sim-decrement">Decrement per move (MM:SS)</label>
              <TimeInput
                id="sim-decrement"
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
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.enableCrazyhouse}
                onChange={(e) => update({ enableCrazyhouse: e.target.checked })}
              />
              Crazyhouse
            </label>
          </div>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.enableChess960}
                onChange={(e) => update({ enableChess960: e.target.checked })}
              />
              Chess960
            </label>
          </div>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={config.enableAtomic}
                onChange={(e) => update({ enableAtomic: e.target.checked })}
              />
              Atomic Chess
            </label>
          </div>
        </fieldset>

        <button className="sim-start-btn" onClick={handleStart}>
          ▶ Start Simulation
        </button>
      </div>

      {children}
    </div>
  );
}
