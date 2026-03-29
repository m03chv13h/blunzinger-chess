import type { Move, ViolationReportEntry, MissedCheckEntry, PieceRemovalEntry, TimeReductionEntry } from '../core/blunziger/types';
import { BlutwurstIcon } from './BlutwurstIcon';
import './MoveList.css';

/** Format available checking moves grouped by category for the tooltip. */
function formatCategorizedMoves(mc: MissedCheckEntry): string {
  const regularMoves = mc.availableRegularMoves;
  const dropMoves = mc.availableDropMoves;
  const removalSquares = mc.availableRemovalSquares;

  // When categorized fields are populated, group moves by type
  if (regularMoves || dropMoves || removalSquares) {
    const parts: string[] = [];
    if (regularMoves && regularMoves.length > 0) {
      const label = mc.isAdditionalMove ? 'Additional move' : 'Normal moves';
      parts.push(`${label}: ${regularMoves.join(', ')}`);
    }
    if (removalSquares && removalSquares.length > 0) {
      parts.push(`Piece removal: ${removalSquares.join(', ')}`);
    }
    if (dropMoves && dropMoves.length > 0) {
      parts.push(`Piece placement: ${dropMoves.join(', ')}`);
    }
    return parts.length > 0 ? ` (${parts.join(' | ')})` : '';
  }

  // Fallback: flat list for legacy entries without categorized fields
  return mc.availableMoves.length > 0
    ? ` (${mc.availableMoves.join(', ')})`
    : '';
}

interface MoveListProps {
  moves: Move[];
  /** Index of the highlighted move in moveHistory, or -1 for none. */
  highlightedMoveIndex?: number;
  /** Called when the user clicks a move in the list. */
  onMoveClick?: (moveIndex: number) => void;
  /** Violation reports to display as icons next to moves. */
  violationReports?: ViolationReportEntry[];
  /** Missed-check violations to display as blutwurst icons next to moves. */
  missedChecks?: MissedCheckEntry[];
  /** Whether the game is over (all missed-check icons become visible). */
  gameOver?: boolean;
  /** Pieces removed as penalty, shown as chess-piece icons next to the offending move. */
  pieceRemovals?: PieceRemovalEntry[];
  /** Time reductions applied as penalty, shown as clock icons next to the offending move. */
  timeReductions?: TimeReductionEntry[];
}

interface MoveEntry {
  move: Move;
  moveIndex: number;
  isExtra: boolean;
}

interface MoveRow {
  number: number;
  white?: MoveEntry;
  black?: MoveEntry;
}

export function MoveList({ moves, highlightedMoveIndex = -1, onMoveClick, violationReports = [], missedChecks = [], gameOver = false, pieceRemovals = [], timeReductions = [] }: MoveListProps) {
  // Build a lookup from moveIndex → report validity for O(1) access
  const reportByMove = new Map<number, ViolationReportEntry>();
  for (const r of violationReports) {
    reportByMove.set(r.moveIndex, r);
  }

  // Build a lookup from moveIndex → missed-check entry for O(1) access
  const missedCheckByMove = new Map<number, MissedCheckEntry>();
  for (const mc of missedChecks) {
    missedCheckByMove.set(mc.moveIndex, mc);
  }

  // Build a lookup from moveIndex → removed pieces for O(1) access
  const removalsByMove = new Map<number, PieceRemovalEntry[]>();
  for (const pr of pieceRemovals) {
    const list = removalsByMove.get(pr.moveIndex) ?? [];
    list.push(pr);
    removalsByMove.set(pr.moveIndex, list);
  }

  // Build a lookup from moveIndex → time reduction for O(1) access
  const timeReductionByMove = new Map<number, TimeReductionEntry>();
  for (const tr of timeReductions) {
    timeReductionByMove.set(tr.moveIndex, tr);
  }

  // Group moves into rows using move.color to place them in the correct column.
  // Extra moves (same color appearing consecutively) are marked.
  const rows: MoveRow[] = [];
  let moveNum = 1;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const isExtra = i > 0 && moves[i].color === moves[i - 1].color;
    const entry: MoveEntry = { move, moveIndex: i, isExtra };

    if (move.color === 'w') {
      rows.push({ number: moveNum++, white: entry });
    } else {
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.white && !lastRow.black) {
        lastRow.black = entry;
      } else {
        rows.push({ number: moveNum++, black: entry });
      }
    }
  }

  const handleClick = (idx: number) => {
    if (onMoveClick) {
      onMoveClick(idx);
    }
  };

  const renderReportIcon = (moveIndex: number) => {
    const report = reportByMove.get(moveIndex);
    if (!report) return null;
    return report.valid
      ? <span className="report-icon report-valid" title="Correct violation report">✅</span>
      : <span className="report-icon report-invalid" title="Incorrect violation report">❌</span>;
  };

  /**
   * Render blutwurst icon for a missed-check violation, but only once the opponent's
   * next move is complete (or the game is over) so we don't reveal information
   * the opponent could use to report the violation.
   */
  const renderMissedCheckIcon = (moveIndex: number) => {
    const mc = missedCheckByMove.get(moveIndex);
    if (!mc) return null;
    // Only reveal after the opponent has made their next move (moveIndex+1 exists) or game ended
    const isVisible = moves.length > moveIndex + 1 || gameOver;
    if (!isVisible) return null;
    const movesInfo = formatCategorizedMoves(mc);
    let title: string;
    switch (mc.violationType) {
      case 'missed_check':
        title = `Missed a possible check${movesInfo}`;
        break;
      case 'gave_forbidden_check':
        title = `Gave a forbidden check${movesInfo}`;
        break;
      case 'missed_check_removal':
        title = `Missed a check-creating removal${movesInfo}`;
        break;
      case 'gave_forbidden_check_removal':
        title = `Gave a forbidden check-creating removal${movesInfo}`;
        break;
    }
    return <span className="report-icon missed-check" title={title}><BlutwurstIcon /></span>;
  };

  /** Map piece type + color to a Unicode chess symbol. */
  const pieceSymbol = (type: string, color: string): string => {
    const symbols: Record<string, Record<string, string>> = {
      w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
      b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
    };
    return symbols[color]?.[type] ?? '?';
  };

  /** Render piece-removal icons for the given move index. */
  const renderPieceRemovalIcons = (moveIndex: number) => {
    const entries = removalsByMove.get(moveIndex);
    if (!entries || entries.length === 0) return null;
    return entries.map((entry, i) => (
      <span key={`pr-${i}`} className="report-icon piece-removal" title={`Piece removed (penalty)`}>
        {pieceSymbol(entry.pieceType, entry.pieceColor)}
      </span>
    ));
  };

  /** Render a time-reduction icon for the given move index. */
  const renderTimeReductionIcon = (moveIndex: number) => {
    const tr = timeReductionByMove.get(moveIndex);
    if (!tr) return null;
    return (
      <span className="report-icon time-reduction" title={`−${tr.seconds}s time penalty`}>⏱️</span>
    );
  };

  const renderMoveCell = (entry: MoveEntry | undefined, colorClass: string) => {
    if (!entry) {
      return <span className={colorClass} />;
    }
    const { move, moveIndex, isExtra } = entry;
    return (
      <span
        className={[
          colorClass,
          moveIndex === highlightedMoveIndex ? 'move-active' : '',
          onMoveClick ? 'move-clickable' : '',
          isExtra ? 'move-extra' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => handleClick(moveIndex)}
        role={onMoveClick ? 'button' : undefined}
        tabIndex={onMoveClick ? 0 : undefined}
      >
        {move.san}
        {isExtra && <span className="extra-label" title="Extra move (penalty)">&nbsp;⚡</span>}
        {renderReportIcon(moveIndex)}
        {renderMissedCheckIcon(moveIndex)}
        {renderPieceRemovalIcons(moveIndex)}
        {renderTimeReductionIcon(moveIndex)}
      </span>
    );
  };

  return (
    <div className="move-list">
      <h3>Moves</h3>
      <div className="move-list-content">
        <div className="move-pair move-header" role="row">
          <span className="move-number">#</span>
          <span className="move-white">White</span>
          <span className="move-black">Black</span>
        </div>
        {rows.length === 0 && <p className="no-moves">No moves yet</p>}
        {rows.map((row) => (
          <div key={`${row.number}-${row.white?.moveIndex ?? 'x'}-${row.black?.moveIndex ?? 'x'}`} className="move-pair">
            <span className="move-number">{row.number}.</span>
            {renderMoveCell(row.white, 'move-white')}
            {renderMoveCell(row.black, 'move-black')}
          </div>
        ))}
      </div>
    </div>
  );
}
