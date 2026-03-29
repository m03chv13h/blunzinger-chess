import { useState, useCallback } from 'react';
import { Chess, validateFen } from 'chess.js';
import type { GameSetupConfig, VariantMode, GameType } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG, VARIANT_MODE_DEFINITIONS, INITIAL_FEN } from '../core/blunziger/types';
import { MiniBoard } from './MiniBoard';
import './AnalysePositionForm.css';

interface AnalysePositionFormProps {
  onStartAnalysis: (config: GameSetupConfig) => void;
}

export function AnalysePositionForm({ onStartAnalysis }: AnalysePositionFormProps) {
  const [fen, setFen] = useState(INITIAL_FEN);
  const [variantMode, setVariantMode] = useState<VariantMode>('classic_blunzinger');
  const [gameType, setGameType] = useState<GameType>('report_incorrectness');
  const [enableKingOfTheHill, setEnableKingOfTheHill] = useState(false);
  const [enableCrazyhouse, setEnableCrazyhouse] = useState(false);
  const [enableDoubleCheckPressure, setEnableDoubleCheckPressure] = useState(false);

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
      mode: 'hvh',
      variantMode,
      gameType,
      enableKingOfTheHill,
      enableCrazyhouse,
      enableDoubleCheckPressure,
      initialFen: fen === INITIAL_FEN ? undefined : fen,
    };
    onStartAnalysis(config);
  }, [fen, fenValid, positionPlayable, variantMode, gameType, enableKingOfTheHill, enableCrazyhouse, enableDoubleCheckPressure, onStartAnalysis]);

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
                checked={enableCrazyhouse}
                onChange={(e) => setEnableCrazyhouse(e.target.checked)}
              />
              Crazyhouse
            </label>
            <label>
              <input
                type="checkbox"
                checked={enableDoubleCheckPressure}
                onChange={(e) => setEnableDoubleCheckPressure(e.target.checked)}
              />
              Double Check Pressure
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
