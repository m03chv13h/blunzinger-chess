import type { GameRecord } from '../core/gameRecord';
import { getGameModeLabel, getVariantLabel, getGameTypeLabel, getResultLabel } from '../core/gameRecord';
import { MiniBoard } from './MiniBoard';
import './AnalyseSection.css';

interface AnalyseSectionProps {
  games: GameRecord[];
  onSelectGame: (game: GameRecord) => void;
}

export function AnalyseSection({ games, onSelectGame }: AnalyseSectionProps) {
  if (games.length === 0) {
    return (
      <div className="analyse-section">
        <div className="analyse-card">
          <h2>📊 Analyse</h2>
          <p className="analyse-empty">
            No games played yet. Start a game from <strong>Quick Start</strong> or{' '}
            <strong>New Game</strong> and complete it to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="analyse-section">
      <div className="analyse-card">
        <h2>📊 Analyse</h2>
        <p className="analyse-subtitle">
          Select a completed game to review and analyse it move by move.
        </p>

        <div className="analyse-list">
          {games.map((game) => (
            <button
              key={game.id}
              className="analyse-game-item"
              onClick={() => onSelectGame(game)}
            >
              <MiniBoard fen={game.finalFen} />
              <div className="analyse-game-info">
                <div className="analyse-game-meta">
                  <span className="analyse-variant">{getVariantLabel(game.config.variantMode)}</span>
                  <span className="analyse-separator">·</span>
                  <span className="analyse-gametype">{getGameTypeLabel(game.config.gameType)}</span>
                </div>
                <div className="analyse-game-mode">
                  {getGameModeLabel(game.config.mode)}
                </div>
                <div className={`analyse-game-result ${game.result.winner === 'draw' ? 'result-draw' : game.result.winner === 'w' ? 'result-white' : 'result-black'}`}>
                  {getResultLabel(game.result)}
                  <span className="analyse-reason"> — {game.result.reason.replace(/_/g, ' ')}</span>
                </div>
                <div className="analyse-game-details">
                  {game.moveCount} moves · {new Date(game.completedAt).toLocaleString()}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
