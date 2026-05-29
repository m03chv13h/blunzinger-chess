import type { GameSetupConfig } from '../core/blunzinger/types';
import type { GameRecord } from '../core/gameRecord';
import type { SimulationGameEntry, SimulationStanding } from '../hooks/useSimulation';
import { SimulationDetailsTable } from './SimulationDetailsTable';
import './SimulationSection.css';

interface SimulationViewProps {
  config: GameSetupConfig;
  games: SimulationGameEntry[];
  standing: SimulationStanding;
  running: boolean;
  onStop: () => void;
  onAnalyseGame: (record: GameRecord) => void;
  /** When provided, shows a "Back to Setup" button when not running. */
  onBackToSetup?: () => void;
  /** Error message when the simulation fails to start. */
  error?: string;
}

export function SimulationView({
  config,
  games,
  standing,
  running,
  onStop,
  onAnalyseGame,
  onBackToSetup,
  error,
}: SimulationViewProps) {
  const progressPct = standing.total > 0
    ? Math.round((standing.completed / standing.total) * 100)
    : 0;

  return (
    <div className="simulation-card simulation-card--wide">
      <h3>🔬 Simulation</h3>

      {/* ── Game details table ── */}
      <SimulationDetailsTable config={config} />

      {/* ── Error message ── */}
      {error && (
        <div className="sim-error">
          <span className="sim-error-icon">⚠️</span>
          <span className="sim-error-message">{error}</span>
        </div>
      )}

      {/* ── Standing ── */}
      <div className="sim-standing">
        <div className="sim-standing-row">
          <span className="sim-standing-label">White wins</span>
          <span className="sim-standing-value sim-standing-white">{standing.whiteWins}</span>
        </div>
        <div className="sim-standing-row">
          <span className="sim-standing-label">Black wins</span>
          <span className="sim-standing-value sim-standing-black">{standing.blackWins}</span>
        </div>
        <div className="sim-standing-row">
          <span className="sim-standing-label">Draws</span>
          <span className="sim-standing-value sim-standing-draw">{standing.draws}</span>
        </div>
        <div className="sim-standing-row">
          <span className="sim-standing-label">Completed</span>
          <span className="sim-standing-value">
            {standing.completed} / {standing.total}
          </span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="sim-progress-bar">
        <div
          className="sim-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Controls ── */}
      <div className="sim-controls">
        {running ? (
          <button className="sim-stop-btn" onClick={onStop}>
            ⏹ Stop Simulation
          </button>
        ) : onBackToSetup ? (
          <button className="sim-back-btn" onClick={onBackToSetup}>
            ← Back to Setup
          </button>
        ) : null}
      </div>

      {/* ── Game list ── */}
      <div className="sim-game-list">
        {games.map((game) => (
          <div key={game.index} className="sim-game-row">
            <span className="sim-game-number">#{game.index}</span>
            {game.finished ? (
              <>
                <span className="sim-game-moves">{game.moveCount} moves</span>
                <span className={`sim-game-result ${
                  game.record?.result.winner === 'w' ? 'result-white' :
                  game.record?.result.winner === 'b' ? 'result-black' :
                  'result-draw'
                }`}>
                  {game.resultLabel}
                </span>
                <span className="sim-game-reason">
                  {game.record?.result.reason.replace(/_/g, ' ')}
                </span>
                <button
                  className="sim-analyse-btn"
                  onClick={() => game.record && onAnalyseGame(game.record)}
                >
                  📊 Analyse
                </button>
              </>
            ) : (
              <>
                <span className="sim-game-pending">
                  <span className="sim-spinner" />
                  Waiting...
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
