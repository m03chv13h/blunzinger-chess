import { useState, useCallback } from 'react';
import { Chess, validateFen } from 'chess.js';
import type { GameSetupConfig, GameMode, VariantMode, GameType } from '../core/blunzinger/types';
import { DEFAULT_SETUP_CONFIG, VARIANT_MODE_DEFINITIONS, INITIAL_FEN } from '../core/blunzinger/types';
import { MiniBoard } from './MiniBoard';
import { TimeInput } from './TimeInput';
import './AnalysePositionForm.css';

interface AnalysePositionFormProps {
  onStartAnalysis: (config: GameSetupConfig) => void;
}

export function AnalysePositionForm({ onStartAnalysis }: AnalysePositionFormProps) {
  const [fen, setFen] = useState(INITIAL_FEN);
  const [mode, setMode] = useState<GameMode>('hvh');
  const [variantMode, setVariantMode] = useState<VariantMode>('classic_blunzinger');
  const [gameType, setGameType] = useState<GameType>('report_incorrectness');
  const [enableKingOfTheHill, setEnableKingOfTheHill] = useState(false);
  const [enableClock, setEnableClock] = useState(false);
  const [initialTimeMs, setInitialTimeMs] = useState(5 * 60 * 1000);
  const [incrementMs, setIncrementMs] = useState(0);
  const [decrementMs, setDecrementMs] = useState(0);
  const [enableCrazyhouse, setEnableCrazyhouse] = useState(false);
  const [enableDoubleCheckPressure, setEnableDoubleCheckPressure] = useState(false);
  const [enableChess960, setEnableChess960] = useState(false);
  const [enableAtomic, setEnableAtomic] = useState(false);

  const fenValidation = validateFen(fen);
  const fenValid = fenValidation.ok;

  // Check the position is not game-over so the user can actually play
  const positionPlayable = (() => {
    if (!fenValid) return false;
    try {
      const chess = new Chess(fen);
      return !chess.isGameOver();
    } catch {
      return false;
    }
  })();

  const fenError = !fenValid
    ? fenValidation.error
    : !positionPlayable
      ? 'Position is already game over'
      : null;

  const handleStart = useCallback(() => {
    if (!fenValid || !positionPlayable) return;
    const config: GameSetupConfig = {
      ...DEFAULT_SETUP_CONFIG,
      mode,
      variantMode,
      gameType,
      enableKingOfTheHill,
      enableClock,
      initialTimeMs,
      incrementMs,
      decrementMs,
      enableCrazyhouse,
      enableDoubleCheckPressure,
      enableChess960,
      enableAtomic,
      initialFen: fen === INITIAL_FEN ? undefined : fen,
    };
    onStartAnalysis(config);
  }, [fen, fenValid, positionPlayable, mode, variantMode, gameType, enableKingOfTheHill, enableClock, initialTimeMs, incrementMs, decrementMs, enableCrazyhouse, enableDoubleCheckPressure, enableChess960, enableAtomic, onStartAnalysis]);

  return (
    <div className="analyse-position-form">
      <h3 className="analyse-section-heading">🔍 Analyse Position</h3>
      <p className="analyse-position-hint">
        Paste a FEN string and configure the game mode to analyse a specific position.
      </p>

      <div className="analyse-position-row">
        <div className="analyse-position-fields">
          <div className="analyse-field">
            <label htmlFor="analyse-fen-input">FEN</label>
            <input
              id="analyse-fen-input"
              type="text"
              className={`analyse-fen-input ${fenError ? 'fen-invalid' : ''}`}
              value={fen}
              onChange={(e) => setFen(e.target.value)}
              placeholder="Paste FEN string…"
              aria-label="FEN string for analysis"
            />
            {fenError && <p className="analyse-fen-error">{fenError}</p>}
          </div>

          <div className="analyse-field">
            <label htmlFor="analyse-mode-select">Player Mode</label>
            <select
              id="analyse-mode-select"
              value={mode}
              onChange={(e) => setMode(e.target.value as GameMode)}
            >
              <option value="hvh">Human vs Human</option>
              <option value="hvbot">Human vs Bot</option>
              <option value="botvbot">Bot vs Bot</option>
            </select>
          </div>

          <div className="analyse-field">
            <label htmlFor="analyse-variant-select">Variant Mode</label>
            <select
              id="analyse-variant-select"
              value={variantMode}
              onChange={(e) => setVariantMode(e.target.value as VariantMode)}
            >
              {VARIANT_MODE_DEFINITIONS.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          </div>

          <div className="analyse-field">
            <label htmlFor="analyse-gametype-select">Game Type</label>
            <select
              id="analyse-gametype-select"
              value={gameType}
              onChange={(e) => setGameType(e.target.value as GameType)}
            >
              <option value="report_incorrectness">Report Incorrectness</option>
              <option value="penalty_on_miss">Penalty on Miss</option>
            </select>
          </div>

          <fieldset className="analyse-overlays">
            <legend>Overlays</legend>
            <label>
              <input
                type="checkbox"
                checked={enableKingOfTheHill}
                onChange={(e) => setEnableKingOfTheHill(e.target.checked)}
              />
              King of the Hill
            </label>
            <label>
              <input
                type="checkbox"
                checked={enableClock}
                onChange={(e) => setEnableClock(e.target.checked)}
              />
              Clock
            </label>
            {enableClock && (
              <div className="analyse-clock-settings">
                <div className="analyse-field">
                  <label htmlFor="analyse-initial-time">Initial time (MM:SS)</label>
                  <TimeInput
                    id="analyse-initial-time"
                    valueMs={initialTimeMs}
                    onChange={setInitialTimeMs}
                    minSeconds={10}
                    maxSeconds={3600}
                    fallbackMs={5 * 60 * 1000}
                  />
                </div>
                <div className="analyse-field">
                  <label htmlFor="analyse-increment">Increment per move (MM:SS)</label>
                  <TimeInput
                    id="analyse-increment"
                    valueMs={incrementMs}
                    onChange={setIncrementMs}
                    minSeconds={0}
                    maxSeconds={600}
                    fallbackMs={0}
                  />
                </div>
                <div className="analyse-field">
                  <label htmlFor="analyse-decrement">Decrement per move (MM:SS)</label>
                  <TimeInput
                    id="analyse-decrement"
                    valueMs={decrementMs}
                    onChange={setDecrementMs}
                    minSeconds={0}
                    maxSeconds={600}
                    fallbackMs={0}
                  />
                </div>
              </div>
            )}
            <label>
              <input
                type="checkbox"
                checked={enableDoubleCheckPressure}
                onChange={(e) => setEnableDoubleCheckPressure(e.target.checked)}
              />
              Double Check Pressure
            </label>
            <label>
              <input
                type="checkbox"
                checked={enableCrazyhouse}
                onChange={(e) => setEnableCrazyhouse(e.target.checked)}
              />
              Crazyhouse
            </label>
            <label>
              <input
                type="checkbox"
                checked={enableChess960}
                onChange={(e) => setEnableChess960(e.target.checked)}
              />
              Chess960
            </label>
            <label>
              <input
                type="checkbox"
                checked={enableAtomic}
                onChange={(e) => setEnableAtomic(e.target.checked)}
              />
              Atomic Chess
            </label>
          </fieldset>
        </div>

        {fenValid && (
          <div className="analyse-position-preview">
            <MiniBoard fen={fen} />
          </div>
        )}
      </div>

      <button
        className="analyse-start-btn"
        onClick={handleStart}
        disabled={!fenValid || !positionPlayable}
      >
        ▶ Start Analysis
      </button>
    </div>
  );
}
