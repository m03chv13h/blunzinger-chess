import { useState } from 'react';
import type { GameRecord } from '../core/gameRecord';
import type { SimulationRecord } from '../core/gameRecord';
import type { GameSetupConfig, GameResult } from '../core/blunziger/types';
import type { GameListItem } from '../services/gamesService';
import { getGameModeLabel, getVariantLabel, getGameTypeLabel, getResultLabel } from '../core/gameRecord';
import { MiniBoard } from './MiniBoard';
import { AnalysePositionForm } from './AnalysePositionForm';
import './AnalyseSection.css';

/** Safely parse a JSON-encoded GameSetupConfig from a remote game. */
function parseRemoteConfig(json: string): GameSetupConfig | null {
  try {
    return JSON.parse(json) as GameSetupConfig;
  } catch {
    return null;
  }
}

/** Safely parse a JSON-encoded GameResult from a remote game. */
function parseRemoteResult(json?: string): GameResult | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as GameResult;
  } catch {
    return null;
  }
}

interface AnalyseSectionProps {
  games: GameRecord[];
  simulations: SimulationRecord[];
  onSelectGame: (game: GameRecord) => void;
  onStartAnalysis: (config: GameSetupConfig) => void;
  /** Remote saved games from the backend (connected mode). */
  remoteGames?: GameListItem[];
  remoteTotal?: number;
  remotePage?: number;
  remoteLoading?: boolean;
  remoteError?: string | null;
  onFetchRemotePage?: (page: number) => void;
  onSelectRemoteGame?: (id: string) => void;
  onDeleteRemoteGame?: (id: string) => void;
}

export function AnalyseSection({
  games,
  simulations,
  onSelectGame,
  onStartAnalysis,
  remoteGames,
  remoteTotal,
  remotePage,
  remoteLoading,
  remoteError,
  onFetchRemotePage,
  onSelectRemoteGame,
  onDeleteRemoteGame,
}: AnalyseSectionProps) {
  const [expandedSimulation, setExpandedSimulation] = useState<string | null>(null);

  const hasRemoteGames = (remoteGames?.length ?? 0) > 0;
  const isEmpty = games.length === 0 && simulations.length === 0 && !hasRemoteGames && !remoteLoading && !remoteError;

  if (isEmpty) {
    return (
      <div className="analyse-section">
        <div className="analyse-card">
          <h2>📊 Analyse</h2>
          <AnalysePositionForm onStartAnalysis={onStartAnalysis} />
          <p className="analyse-empty">
            No games played yet. Start a game from <strong>Quick Start</strong> or{' '}
            <strong>New Game</strong> and complete it to see it here.
          </p>
        </div>
      </div>
    );
  }

  // If a simulation is expanded, show its games
  const expandedSim = simulations.find((s) => s.id === expandedSimulation);
  if (expandedSim) {
    return (
      <div className="analyse-section">
        <div className="analyse-card">
          <button
            className="analyse-back-btn"
            onClick={() => setExpandedSimulation(null)}
          >
            ← Back to overview
          </button>
          <h2>🔬 Simulation Games</h2>
          <div className="analyse-sim-summary-header">
            <span className="sim-tag">{getVariantLabel(expandedSim.config.variantMode)}</span>
            <span className="sim-tag">{getGameTypeLabel(expandedSim.config.gameType)}</span>
            <span className="sim-tag">
              W {expandedSim.standing.whiteWins} · B {expandedSim.standing.blackWins} · D {expandedSim.standing.draws}
            </span>
          </div>
          <p className="analyse-subtitle">
            {expandedSim.games.length} game{expandedSim.games.length !== 1 ? 's' : ''} · {new Date(expandedSim.completedAt).toLocaleString()}
          </p>

          <div className="analyse-list">
            {expandedSim.games.map((game, i) => (
              <button
                key={game.id}
                className="analyse-game-item"
                onClick={() => onSelectGame(game)}
              >
                <MiniBoard fen={game.finalFen} />
                <div className="analyse-game-info">
                  <div className="analyse-game-meta">
                    <span className="analyse-variant">Game #{i + 1}</span>
                    <span className="analyse-separator">·</span>
                    <span className="analyse-gametype">{getVariantLabel(game.config.variantMode)}</span>
                  </div>
                  <div className={`analyse-game-result ${game.result.winner === 'draw' ? 'result-draw' : game.result.winner === 'w' ? 'result-white' : 'result-black'}`}>
                    {getResultLabel(game.result)}
                    <span className="analyse-reason"> — {game.result.reason.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="analyse-game-details">
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

  return (
    <div className="analyse-section">
      <div className="analyse-card">
        <h2>📊 Analyse</h2>
        <p className="analyse-subtitle">
          Analyse a specific position, or select a completed game to review move by move.
        </p>

        <AnalysePositionForm onStartAnalysis={onStartAnalysis} />

        {/* ── Played Games ── */}
        {games.length > 0 && (
          <>
            <h3 className="analyse-section-heading">🎮 Played Games</h3>
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
          </>
        )}

        {/* ── Simulations ── */}
        {simulations.length > 0 && (
          <>
            <h3 className="analyse-section-heading">🔬 Simulations</h3>
            <div className="analyse-list">
              {simulations.map((sim) => (
                <button
                  key={sim.id}
                  className="analyse-sim-item"
                  onClick={() => setExpandedSimulation(sim.id)}
                >
                  <div className="analyse-sim-icon">🔬</div>
                  <div className="analyse-game-info">
                    <div className="analyse-game-meta">
                      <span className="analyse-variant">{getVariantLabel(sim.config.variantMode)}</span>
                      <span className="analyse-separator">·</span>
                      <span className="analyse-gametype">{getGameTypeLabel(sim.config.gameType)}</span>
                    </div>
                    <div className="analyse-sim-standing">
                      <span className="result-white">W {sim.standing.whiteWins}</span>
                      <span className="analyse-separator">·</span>
                      <span className="result-black">B {sim.standing.blackWins}</span>
                      <span className="analyse-separator">·</span>
                      <span className="result-draw">D {sim.standing.draws}</span>
                    </div>
                    <div className="analyse-game-details">
                      {sim.games.length} game{sim.games.length !== 1 ? 's' : ''} · {new Date(sim.completedAt).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Saved Games (remote / connected mode) ── */}
        {(hasRemoteGames || remoteLoading || remoteError) && (
          <>
            <h3 className="analyse-section-heading">☁️ Saved Games</h3>

            {remoteError && (
              <p className="analyse-remote-error">{remoteError}</p>
            )}

            {remoteLoading && !hasRemoteGames && (
              <p className="analyse-remote-loading">Loading saved games…</p>
            )}

            {hasRemoteGames && (
              <div className="analyse-list">
                {(remoteGames ?? []).map((item) => {
                  const config = parseRemoteConfig(item.matchConfig);
                  const result = parseRemoteResult(item.result);
                  return (
                    <div key={item.id} className="analyse-remote-row">
                      <button
                        className="analyse-game-item analyse-game-item--remote"
                        onClick={() => onSelectRemoteGame?.(item.id)}
                        disabled={remoteLoading}
                      >
                        {item.finalFen && <MiniBoard fen={item.finalFen} />}
                        <div className="analyse-game-info">
                          {config && (
                            <div className="analyse-game-meta">
                              <span className="analyse-variant">{getVariantLabel(config.variantMode)}</span>
                              <span className="analyse-separator">·</span>
                              <span className="analyse-gametype">{getGameTypeLabel(config.gameType)}</span>
                            </div>
                          )}
                          {config && (
                            <div className="analyse-game-mode">
                              {getGameModeLabel(config.mode)}
                            </div>
                          )}
                          {result && (
                            <div className={`analyse-game-result ${result.winner === 'draw' ? 'result-draw' : result.winner === 'w' ? 'result-white' : 'result-black'}`}>
                              {getResultLabel(result)}
                              <span className="analyse-reason"> — {result.reason.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          <div className="analyse-game-details">
                            {item.moveCount} moves
                            {item.completedAt && <> · {new Date(item.completedAt).toLocaleString()}</>}
                          </div>
                        </div>
                      </button>
                      {onDeleteRemoteGame && (
                        <button
                          className="analyse-remote-delete"
                          title="Delete saved game"
                          onClick={() => onDeleteRemoteGame(item.id)}
                          disabled={remoteLoading}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {remoteTotal != null && remoteTotal > 20 && onFetchRemotePage && remotePage != null && (
              <div className="analyse-pagination">
                <button
                  disabled={remotePage <= 1 || remoteLoading}
                  onClick={() => onFetchRemotePage(remotePage - 1)}
                >
                  ← Prev
                </button>
                <span className="analyse-page-info">
                  Page {remotePage} of {Math.ceil(remoteTotal / 20)}
                </span>
                <button
                  disabled={remotePage >= Math.ceil(remoteTotal / 20) || remoteLoading}
                  onClick={() => onFetchRemotePage(remotePage + 1)}
                >
                  Next →
                </button>
              </div>
            )}

            {remoteLoading && hasRemoteGames && (
              <p className="analyse-remote-loading">Loading…</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
