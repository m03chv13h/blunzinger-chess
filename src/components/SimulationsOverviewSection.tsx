import { useState } from 'react';
import type { SimulationListItem } from '../services/simulationService';
import type { SimulationRecord } from '../core/gameRecord';
import { getVariantLabel, getGameTypeLabel } from '../core/gameRecord';
import type { GameSetupConfig } from '../core/blunziger/types';
import { DEFAULT_SETUP_CONFIG } from '../core/blunziger/types';
import { SimulationDetailsTable } from './SimulationDetailsTable';
import './SimulationsOverviewSection.css';

/** Unified simulation item shape for display. */
interface SimulationDisplayItem {
  id: string;
  config: GameSetupConfig;
  gameCount: number;
  completedGames: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  createdAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'abandoned';
}

/** Convert a remote SimulationListItem to display shape. */
function fromRemoteItem(item: SimulationListItem): SimulationDisplayItem {
  let config: GameSetupConfig;
  try {
    config = JSON.parse(item.configJson) as GameSetupConfig;
  } catch {
    config = { ...DEFAULT_SETUP_CONFIG, mode: 'botvbot' };
  }
  return {
    id: item.id,
    config,
    gameCount: item.gameCount,
    completedGames: item.completedGames,
    whiteWins: item.whiteWins,
    blackWins: item.blackWins,
    draws: item.draws,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    status: item.status,
  };
}

/** Convert a local SimulationRecord to display shape. */
function fromLocalRecord(rec: SimulationRecord): SimulationDisplayItem {
  return {
    id: rec.id,
    config: rec.config,
    gameCount: rec.games.length,
    completedGames: rec.games.length,
    whiteWins: rec.standing.whiteWins,
    blackWins: rec.standing.blackWins,
    draws: rec.standing.draws,
    createdAt: new Date(rec.completedAt).toISOString(),
    completedAt: new Date(rec.completedAt).toISOString(),
    status: 'completed',
  };
}

export interface SimulationsOverviewProps {
  /** Remote simulation list items (connected mode). */
  remoteSimulations?: SimulationListItem[];
  /** Local simulation records (static mode). */
  localSimulations?: SimulationRecord[];
  /** Whether remote simulations are loading. */
  loading?: boolean;
  /** Error message from fetching. */
  error?: string | null;
  /** Pagination: current page. */
  page?: number;
  /** Pagination: total items. */
  total?: number;
  /** Pagination: page size. */
  pageSize?: number;
  /** Page change handler. */
  onPageChange?: (page: number) => void;
  /** Callback when user selects a simulation to view. */
  onSelectSimulation?: (id: string) => void;
}

export function SimulationsOverviewSection({
  remoteSimulations,
  localSimulations,
  loading,
  error,
  page,
  total,
  pageSize,
  onPageChange,
  onSelectSimulation,
}: SimulationsOverviewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Merge remote and local items into a unified list.
  // Remote items take priority; local items fill in for static mode.
  const items: SimulationDisplayItem[] = remoteSimulations
    ? remoteSimulations.map(fromRemoteItem)
    : (localSimulations ?? []).map(fromLocalRecord);

  if (items.length === 0 && !loading) {
    return (
      <div className="sim-overview">
        <h3 className="sim-overview-heading">📋 Your Simulations</h3>
        <p className="sim-overview-empty">
          No simulations yet. Configure and run one above to see it here.
        </p>
      </div>
    );
  }

  const totalPages = total && pageSize ? Math.ceil(total / pageSize) : 1;

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="sim-overview">
      <h3 className="sim-overview-heading">📋 Your Simulations</h3>

      {loading && <p className="sim-overview-loading">Loading simulations…</p>}
      {error && <p className="sim-overview-error">{error}</p>}

      <div className="sim-overview-list">
        {items.map((item) => {
          const isExpanded = expandedIds.has(item.id);
          return (
            <div key={item.id} className={`sim-overview-item-wrapper${isExpanded ? ' sim-overview-item-wrapper--expanded' : ''}`}>
              <div className="sim-overview-item">
                <div
                  className="sim-overview-item-main"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectSimulation?.(item.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && onSelectSimulation) {
                      e.preventDefault();
                      onSelectSimulation(item.id);
                    }
                  }}
                >
                  <div className="sim-overview-icon">
                    {item.status === 'running' ? (
                      <span className="sim-overview-spinner" title="Running" />
                    ) : (
                      '🔬'
                    )}
                  </div>
                  <div className="sim-overview-info">
                    <div className="sim-overview-meta">
                      <span className="sim-overview-variant">
                        {getVariantLabel(item.config.variantMode)}
                      </span>
                      <span className="sim-overview-sep">·</span>
                      <span className="sim-overview-gametype">
                        {getGameTypeLabel(item.config.gameType)}
                      </span>
                    </div>
                    <div className="sim-overview-standing">
                      <span className="sim-overview-white">W {item.whiteWins}</span>
                      <span className="sim-overview-sep">·</span>
                      <span className="sim-overview-black">B {item.blackWins}</span>
                      <span className="sim-overview-sep">·</span>
                      <span className="sim-overview-draw">D {item.draws}</span>
                    </div>
                    <div className="sim-overview-details">
                      {item.completedGames}/{item.gameCount} games
                      {item.status === 'running' && (
                        <span className="sim-overview-status sim-overview-status--running"> · Running</span>
                      )}
                      {item.status === 'completed' && item.completedAt && (
                        <span className="sim-overview-date"> · {new Date(item.completedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  className="sim-overview-info-toggle"
                  title={isExpanded ? 'Hide details' : 'Show details'}
                  aria-expanded={isExpanded}
                  onClick={() => toggleExpanded(item.id)}
                >
                  ℹ️
                </button>
              </div>
              {isExpanded && (
                <div className="sim-overview-expanded">
                  <SimulationDetailsTable config={item.config} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination (remote mode only) */}
      {onPageChange && total != null && pageSize != null && page != null && total > pageSize && (
        <div className="sim-overview-pagination">
          <button
            disabled={page <= 1 || !!loading}
            onClick={() => onPageChange(page - 1)}
          >
            ← Prev
          </button>
          <span className="sim-overview-page-info">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages || !!loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
