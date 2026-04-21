import { useRef, useState } from 'react';
import type { GameRecord } from '../core/gameRecord';
import type { GameSetupConfig } from '../core/blunziger/types';
import { getGameModeLabel, getVariantLabel, getGameTypeLabel, getResultLabel, getUserOutcome, getUserResultLabel } from '../core/gameRecord';
import { MiniBoard } from './MiniBoard';
import './PlayedGamesSection.css';

interface ResultsTally {
  wins: number;
  losses: number;
  draws: number;
  /** Games with no user perspective (botvbot, hvh offline). */
  neutral: number;
  total: number;
}

/** Compute win/loss/draw/neutral tallies for a list of games. */
function computeResultsTally(games: GameRecord[]): ResultsTally {
  let wins = 0, losses = 0, draws = 0, neutral = 0;
  for (const game of games) {
    const outcome = getUserOutcome(game.result, game.config);
    if (outcome === null) {
      neutral++;
    } else if (outcome === 'win') {
      wins++;
    } else if (outcome === 'loss') {
      losses++;
    } else {
      draws++;
    }
  }
  return { wins, losses, draws, neutral, total: games.length };
}

function ResultsSummary({ tally }: { tally: ResultsTally }) {
  const parts: React.ReactNode[] = [];
  if (tally.wins > 0) {
    parts.push(<span key="w" className="results-badge results-badge--win">{tally.wins}W</span>);
  }
  if (tally.losses > 0) {
    parts.push(<span key="l" className="results-badge results-badge--loss">{tally.losses}L</span>);
  }
  if (tally.draws > 0) {
    parts.push(<span key="d" className="results-badge results-badge--draw">{tally.draws}D</span>);
  }
  if (tally.neutral > 0) {
    parts.push(<span key="n" className="results-badge results-badge--neutral">{tally.neutral} spectated</span>);
  }
  if (parts.length === 0) return null;
  return <span className="results-summary">{parts}</span>;
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
  /** Games with no user perspective (botvbot, hvh offline). */
  neutral: number;
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
      day = { date: dateKey, wins: 0, draws: 0, losses: 0, neutral: 0 };
      dayMap.set(dateKey, day);
    }

    // Bot vs bot and offline human vs human have no user perspective – show as neutral (white)
    if (game.config.mode === 'botvbot' || game.config.mode === 'hvh') {
      day.neutral++;
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

  return (
    <div className="games-timeline">
      <h3 className="games-timeline-title">Activity (last year)</h3>
      <div className="games-timeline-chart">
        {timeline.map((day) => {
          const total = day.wins + day.draws + day.losses + day.neutral;
          const winPct = (day.wins / total) * 100;
          const drawPct = (day.draws / total) * 100;
          const lossPct = (day.losses / total) * 100;
          const neutralPct = (day.neutral / total) * 100;

          return (
            <div
              key={day.date}
              className="timeline-bar-wrapper"
              title={`${day.date}: ${day.wins}W ${day.draws}D ${day.losses}L${day.neutral > 0 ? ` ${day.neutral} neutral` : ''}`}
              onClick={() => onBarClick?.(day.date)}
            >
              <div className="timeline-bar">
                {neutralPct > 0 && (
                  <div className="timeline-segment timeline-neutral" style={{ height: `${neutralPct}%` }} />
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

/** A game is "spectated" when the user had no active role (hvh or botvbot). */
function isSpectatedGame(game: GameRecord): boolean {
  return game.config.mode === 'hvh' || game.config.mode === 'botvbot';
}

export type ConnectionFilter = 'all' | 'online' | 'offline';

export function PlayedGamesSection({
  games,
  onAnalyseGame,
}: PlayedGamesSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [includeSpectated, setIncludeSpectated] = useState(true);
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all');

  // Filter out spectated games when the checkbox is unchecked
  const filteredGames = games.filter((g) => {
    if (!includeSpectated && isSpectatedGame(g)) return false;
    if (connectionFilter === 'online' && !g.isOnline) return false;
    if (connectionFilter === 'offline' && g.isOnline) return false;
    return true;
  });

  // Sort games by completedAt descending (most recent first)
  const sortedGames = [...filteredGames].sort((a, b) => b.completedAt - a.completedAt);

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

  // Compute overall tally
  const totalTally = computeResultsTally(sortedGames);

  // Compute per-month tallies by collecting all games for each month
  function getMonthGames(monthKey: string): GameRecord[] {
    const dates = monthGroups.get(monthKey) ?? [];
    return dates.flatMap((dk) => dateGroups.get(dk) ?? []);
  }

  return (
    <div className="played-games-section" ref={containerRef}>
      <div className="played-games-card">
        <h2>🎮 Played Games</h2>

        {/* Filter controls */}
        <div className="played-games-filters">
          <label className="played-games-filter">
            <input
              type="checkbox"
              checked={includeSpectated}
              onChange={(e) => setIncludeSpectated(e.target.checked)}
            />
            Include spectated games
          </label>

          <div className="connection-filter" role="radiogroup" aria-label="Connection filter">
            {(['all', 'online', 'offline'] as const).map((value) => (
              <button
                key={value}
                className={`connection-filter-btn${connectionFilter === value ? ' connection-filter-btn--active' : ''}`}
                onClick={() => setConnectionFilter(value)}
                role="radio"
                aria-checked={connectionFilter === value}
              >
                {value === 'all' ? '🌐 All' : value === 'online' ? '🟢 Online' : '📴 Offline'}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline – always visible */}
        <GameTimeline games={sortedGames} onBarClick={handleTimelineBarClick} />

        {/* Total results summary */}
        {sortedGames.length > 0 && (
          <div className="results-summary-total">
            <span className="results-summary-label">Total ({totalTally.total} game{totalTally.total !== 1 ? 's' : ''}):</span>
            <ResultsSummary tally={totalTally} />
          </div>
        )}

        {/* Empty message when no games */}
        {sortedGames.length === 0 && (
          <p className="played-games-empty">
            No games played yet. Start a game from <strong>Quick Start</strong> or{' '}
            <strong>New Game</strong> and complete it to see it here.
          </p>
        )}

        {/* Games grouped by month and date */}
        {monthKeys.map((monthKey) => {
          const monthTally = computeResultsTally(getMonthGames(monthKey));
          return (
            <div key={monthKey} className="games-month-group">
              <div className="games-month-heading-row">
                <h3 className="games-month-heading">{formatMonth(monthKey)}</h3>
                <ResultsSummary tally={monthTally} />
              </div>
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
          );
        })}
      </div>
    </div>
  );
}
