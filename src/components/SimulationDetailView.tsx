import type { GameRecord, SimulationRecord } from '../core/gameRecord';
import { getVariantLabel, getGameTypeLabel, getResultLabel } from '../core/gameRecord';
import { MiniBoard } from './MiniBoard';
import './SimulationDetailView.css';

interface SimulationDetailViewProps {
  simulation: SimulationRecord;
  onSelectGame: (game: GameRecord) => void;
  onBack: () => void;
}

export function SimulationDetailView({
  simulation,
  onSelectGame,
  onBack,
}: SimulationDetailViewProps) {
  return (
    <div className="simulation-section">
      <div className="simulation-card simulation-card--wide">
        <button
          className="sim-detail-back-btn"
          onClick={onBack}
        >
          ← Back to Simulations
        </button>
        <h2>🔬 Simulation Games</h2>
        <div className="sim-config-summary">
          <span className="sim-tag">{getVariantLabel(simulation.config.variantMode)}</span>
          <span className="sim-tag">{getGameTypeLabel(simulation.config.gameType)}</span>
          <span className="sim-tag">
            W {simulation.standing.whiteWins} · B {simulation.standing.blackWins} · D {simulation.standing.draws}
          </span>
        </div>
        <p className="sim-detail-subtitle">
          {simulation.games.length} game{simulation.games.length !== 1 ? 's' : ''} · {new Date(simulation.completedAt).toLocaleString()}
        </p>

        <div className="sim-detail-list">
          {simulation.games.map((game, i) => (
            <button
              key={game.id}
              className="sim-detail-game-item"
              onClick={() => onSelectGame(game)}
            >
              <MiniBoard fen={game.finalFen} />
              <div className="sim-detail-game-info">
                <div className="sim-detail-game-meta">
                  <span className="sim-detail-game-number">Game #{i + 1}</span>
                  <span className="sim-detail-sep">·</span>
                  <span className="sim-detail-variant">{getVariantLabel(game.config.variantMode)}</span>
                </div>
                <div className={`sim-detail-game-result ${game.result.winner === 'draw' ? 'result-draw' : game.result.winner === 'w' ? 'result-white' : 'result-black'}`}>
                  {getResultLabel(game.result)}
                  <span className="sim-detail-reason"> — {game.result.reason.replace(/_/g, ' ')}</span>
                </div>
                <div className="sim-detail-game-moves">
                  {game.moveCount} moves
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
