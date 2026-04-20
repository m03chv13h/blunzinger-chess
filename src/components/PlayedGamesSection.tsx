import { useRef, useState } from 'react';
import type { GameRecord } from '../core/gameRecord';
import type { GameSetupConfig, GameResult } from '../core/blunziger/types';
import type { GameListItem } from '../services/gamesService';
import { getGameModeLabel, getVariantLabel, getGameTypeLabel, getResultLabel, getUserOutcome, getUserResultLabel } from '../core/gameRecord';
import type { UserOutcome } from '../core/gameRecord';
import { MiniBoard } from './MiniBoard';
import './PlayedGamesSection.css';

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

/** Get a list of enabled overlay labels from a config. */
function getEnabledOverlays(config: GameSetupConfig): string[] {
  const overlays: { flag: boolean; label: string }[] = [
    { flag: config.enableKingOfTheHill, label: 'King of the Hill' },
    { flag: config.enableClock, label: 'Clock' },
    { flag: config.enableDoubleCheckPressure, label: 'Double Check Pressure' },
    { flag: config.enableCrazyhouse, label: 'Crazyhouse' },
    { flag: config.enableChess960, label: 'Chess960' },
    { flag: config.enableAtomic, label: 'Atomic' },
  ];
  return overlays.filter((o) => o.flag).map((o) => o.label);
}

interface PlayedGamesSectionProps {
  games: GameRecord[];
  onAnalyseGame: (game: GameRecord) => void;
  /** Remote saved games from the backend (connected mode). */
  remoteGames?: GameListItem[];
  remoteTotal?: number;
  remotePage?: number;
  remoteLoading?: boolean;
  remoteError?: string | null;
  onFetchRemotePage?: (page: number) => void;
  onSelectRemoteGame?: (id: string) => void;
}

/** Group games by date key (e.g. "2024-03-15"). */
function groupByDate(games: GameRecord[]): Map<string, GameRecord[]> {
  const map = new Map<string, GameRecord[]>();
  for (const game of games) {
    const key = new Date(game.completedAt).toISOString().split('T')[0];
    const arr = map.get(key);
    if (arr) arr.push(game);
    else map.set(key, [game]);
  }
  return map;
}

/** Group date keys by month (e.g. "2024-03"). */
function groupDatesByMonth(dateKeys: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const key of dateKeys) {
    const month = key.slice(0, 7);
    const arr = map.get(month);
    if (arr) arr.push(key);
    else map.set(month, [key]);
  }
  return map;
}

/** Format a date key to a human-readable date string. */
function formatDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format a month key to a human-readable month string. */
function formatMonth(monthKey: string): string {
  const d = new Date(monthKey + '-01T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface TimelineDay {
  date: string;
  wins: number;
  draws: number;
  losses: number;
  /** Games with no user perspective (botvbot, hvh) – shown as white at the top. */
  white: number;
}

/** Build timeline data for the last year. */
function buildTimeline(games: GameRecord[]): TimelineDay[] {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const recentGames = games.filter((g) => g.completedAt >= oneYearAgo.getTime());

  const dayMap = new Map<string, TimelineDay>();
  for (const game of recentGames) {
    const dateKey = new Date(game.completedAt).toISOString().split('T')[0];
    let day = dayMap.get(dateKey);
    if (!day) {
      day = { date: dateKey, wins: 0, draws: 0, losses: 0, white: 0 };
      dayMap.set(dateKey, day);
    }

    // Bot vs bot and offline human vs human have no user perspective – count as white
    if (game.config.mode === 'botvbot' || game.config.mode === 'hvh') {
      day.white++;
    } else if (game.result.winner === 'draw') {
      day.draws++;
    } else if (game.result.winner === 'w') {
      day.wins++;
    } else {
      day.losses++;
    }
  }

  // Sort by date
  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function GameTimeline({ games, onBarClick }: { games: GameRecord[]; onBarClick?: (date: string) => void }) {
  const timeline = buildTimeline(games);

  if (timeline.length === 0) {
    return (
      <div className="games-timeline">
        <h3 className="games-timeline-title">Activity (last year)</h3>
        <div className="games-timeline-chart games-timeline-empty">
          <span className="games-timeline-empty-text">No activity yet</span>
        </div>
      </div>
    );
  }

  const maxGames = Math.max(...timeline.map((d) => d.wins + d.draws + d.losses + d.white), 1);

  return (
    <div className="games-timeline">
      <h3 className="games-timeline-title">Activity (last year)</h3>
      <div className="games-timeline-chart">
        {timeline.map((day) => {
          const total = day.wins + day.draws + day.losses + day.white;
          const height = Math.max((total / maxGames) * 100, 8);
          const winPct = (day.wins / total) * 100;
          const drawPct = (day.draws / total) * 100;
          const lossPct = (day.losses / total) * 100;
          const whitePct = (day.white / total) * 100;

          return (
            <div
              key={day.date}
              className="timeline-bar-wrapper"
              title={`${day.date}: ${day.wins}W ${day.draws}D ${day.losses}L${day.white ? ` ${day.white}⚪` : ''}`}
              onClick={() => onBarClick?.(day.date)}
            >
              <div className="timeline-bar" style={{ height: `${height}%` }}>
                {whitePct > 0 && (
                  <div className="timeline-segment timeline-white" style={{ height: `${whitePct}%` }} />
                )}
                {lossPct > 0 && (
                  <div className="timeline-segment timeline-loss" style={{ height: `${lossPct}%` }} />
                )}
                {drawPct > 0 && (
                  <div className="timeline-segment timeline-draw" style={{ height: `${drawPct}%` }} />
                )}
                {winPct > 0 && (
                  <div className="timeline-segment timeline-win" style={{ height: `${winPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GameCard({
  game,
  onAnalyse,
}: {
  game: GameRecord;
  onAnalyse: (game: GameRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const outcome = getUserOutcome(game.result, game.config);
  const outcomeClass = outcome ? `game-card--${outcome}` : '';

  return (
    <div className={`game-card ${outcomeClass}`}>
      <div className="game-card-main">
        <MiniBoard fen={game.finalFen} />
        <div className="game-card-info">
          <div className={`game-card-result ${outcome ? `result-${outcome}` : ''}`}>
            {outcome ? (
              <>
                <span className="game-card-outcome-badge">{getUserResultLabel(outcome)}</span>
                <span className="game-card-result-detail"> ({getResultLabel(game.result)})</span>
              </>
            ) : (
              getResultLabel(game.result)
            )}
            <span className="game-card-reason"> — {game.result.reason.replace(/_/g, ' ')}</span>
          </div>
          <div className="game-card-meta">
            <span>{getVariantLabel(game.config.variantMode)}</span>
            <span className="game-card-sep">·</span>
            <span>{getGameTypeLabel(game.config.gameType)}</span>
            <span className="game-card-sep">·</span>
            <span>{game.moveCount} moves</span>
          </div>
          <div className="game-card-actions">
            <button className="game-card-analyse-btn" onClick={() => onAnalyse(game)}>
              📊 Analyse
            </button>
            <button
              className="game-card-expand-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '▴ Less' : '▾ Details'}
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="game-card-details">
          <div className="game-card-detail-row">
            <span className="game-card-detail-label">Mode:</span>
            <span>{getGameModeLabel(game.config.mode)}</span>
          </div>
          <div className="game-card-detail-row">
            <span className="game-card-detail-label">Variant:</span>
            <span>{getVariantLabel(game.config.variantMode)}</span>
          </div>
          <div className="game-card-detail-row">
            <span className="game-card-detail-label">Game Type:</span>
            <span>{getGameTypeLabel(game.config.gameType)}</span>
          </div>
          {game.config.mode === 'hvbot' && game.config.botDifficulty && (
            <div className="game-card-detail-row">
              <span className="game-card-detail-label">Bot Difficulty:</span>
              <span>{game.config.botDifficulty}</span>
            </div>
          )}
          {(() => {
            const enabledOverlays = getEnabledOverlays(game.config);
            return enabledOverlays.length > 0 ? (
              <div className="game-card-detail-row">
                <span className="game-card-detail-label">Overlays:</span>
                <span>{enabledOverlays.join(', ')}</span>
              </div>
            ) : null;
          })()}
          <div className="game-card-detail-row">
            <span className="game-card-detail-label">Played:</span>
            <span>{new Date(game.completedAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlayedGamesSection({
  games,
  onAnalyseGame,
  remoteGames,
  remoteTotal,
  remotePage,
  remoteLoading,
  remoteError,
  onFetchRemotePage,
  onSelectRemoteGame,
}: PlayedGamesSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort games by completedAt descending (most recent first)
  const sortedGames = [...games].sort((a, b) => b.completedAt - a.completedAt);

  const hasRemoteGames = (remoteGames?.length ?? 0) > 0;

  const dateGroups = groupByDate(sortedGames);
  const dateKeys = Array.from(dateGroups.keys()).sort((a, b) => b.localeCompare(a));
  const monthGroups = groupDatesByMonth(dateKeys);
  const monthKeys = Array.from(monthGroups.keys()).sort((a, b) => b.localeCompare(a));

  function handleTimelineBarClick(date: string) {
    const target = containerRef.current?.querySelector(`[data-date="${date}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="played-games-section" ref={containerRef}>
      <div className="played-games-card">
        <h2>🎮 Played Games</h2>

        {/* Timeline – always visible */}
        <GameTimeline games={sortedGames} onBarClick={handleTimelineBarClick} />

        {/* Empty message when no games */}
        {sortedGames.length === 0 && !hasRemoteGames && !remoteLoading && !remoteError && (
          <p className="played-games-empty">
            No games played yet. Start a game from <strong>Quick Start</strong> or{' '}
            <strong>New Game</strong> and complete it to see it here.
          </p>
        )}

        {/* Games grouped by month and date */}
        {monthKeys.map((monthKey) => (
          <div key={monthKey} className="games-month-group">
            <h3 className="games-month-heading">{formatMonth(monthKey)}</h3>
            {(monthGroups.get(monthKey) ?? []).map((dateKey) => (
              <div key={dateKey} className="games-date-group" data-date={dateKey}>
                <h4 className="games-date-heading">{formatDate(dateKey)}</h4>
                <div className="games-list">
                  {(dateGroups.get(dateKey) ?? []).map((game) => (
                    <GameCard key={game.id} game={game} onAnalyse={onAnalyseGame} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ── Saved Games (remote / connected mode) ── */}
        {(hasRemoteGames || remoteLoading || remoteError) && (
          <>
            <h3 className="games-month-heading">☁️ Saved Games</h3>

            {remoteError && (
              <p className="played-games-remote-error">{remoteError}</p>
            )}

            {remoteLoading && !hasRemoteGames && (
              <p className="played-games-remote-loading">Loading saved games…</p>
            )}

            {hasRemoteGames && (
              <div className="games-list">
                {(remoteGames ?? []).map((item) => {
                  const config = parseRemoteConfig(item.matchConfig);
                  const result = parseRemoteResult(item.result);
                  const outcome: UserOutcome | null = result && config ? getUserOutcome(result, config) : null;
                  const outcomeClass = outcome ? `game-card--${outcome}` : '';
                  return (
                    <div key={item.id} className={`game-card ${outcomeClass}`}>
                      <div className="game-card-main">
                        {item.finalFen && <MiniBoard fen={item.finalFen} />}
                        <div className="game-card-info">
                          {result && (
                            <div className={`game-card-result ${outcome ? `result-${outcome}` : ''}`}>
                              {outcome ? (
                                <>
                                  <span className="game-card-outcome-badge">{getUserResultLabel(outcome)}</span>
                                  <span className="game-card-result-detail"> ({getResultLabel(result)})</span>
                                </>
                              ) : (
                                getResultLabel(result)
                              )}
                              <span className="game-card-reason"> — {result.reason.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          <div className="game-card-meta">
                            {config && (
                              <>
                                <span>{getVariantLabel(config.variantMode)}</span>
                                <span className="game-card-sep">·</span>
                                <span>{getGameTypeLabel(config.gameType)}</span>
                                <span className="game-card-sep">·</span>
                              </>
                            )}
                            <span>{item.moveCount} moves</span>
                            {item.completedAt && (
                              <>
                                <span className="game-card-sep">·</span>
                                <span>{new Date(item.completedAt).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                          <div className="game-card-actions">
                            <button
                              className="game-card-analyse-btn"
                              onClick={() => onSelectRemoteGame?.(item.id)}
                              disabled={remoteLoading}
                            >
                              📊 Analyse
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {remoteTotal != null && remoteTotal > 20 && onFetchRemotePage && remotePage != null && (
              <div className="played-games-pagination">
                <button
                  disabled={remotePage <= 1 || remoteLoading}
                  onClick={() => onFetchRemotePage(remotePage - 1)}
                >
                  ← Prev
                </button>
                <span className="played-games-page-info">
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
              <p className="played-games-remote-loading">Loading…</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
