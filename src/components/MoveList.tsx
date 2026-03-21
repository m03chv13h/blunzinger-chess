import type { Move, ViolationReportEntry, MissedCheckEntry } from '../core/blunziger/types';
import './MoveList.css';

interface MoveListProps {
  moves: Move[];
  /** Index of the highlighted move in moveHistory, or -1 for none. */
  highlightedMoveIndex?: number;
  /** Called when the user clicks a move in the list. */
  onMoveClick?: (moveIndex: number) => void;
  /** Violation reports to display as icons next to moves. */
  violationReports?: ViolationReportEntry[];
  /** Missed-check violations to display as sausage icons next to moves. */
  missedChecks?: MissedCheckEntry[];
  /** Whether the game is over (all missed-check icons become visible). */
  gameOver?: boolean;
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

export function MoveList({ moves, highlightedMoveIndex = -1, onMoveClick, violationReports = [], missedChecks = [], gameOver = false }: MoveListProps) {
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
   * Render 🌭 icon for a missed-check violation, but only once the opponent's
   * next move is complete (or the game is over) so we don't reveal information
   * the opponent could use to report the violation.
   */
  const renderMissedCheckIcon = (moveIndex: number) => {
    const mc = missedCheckByMove.get(moveIndex);
    if (!mc) return null;
    // Only reveal after the opponent has made their next move (moveIndex+1 exists) or game ended
    const isVisible = moves.length > moveIndex + 1 || gameOver;
    if (!isVisible) return null;
    const title = mc.violationType === 'missed_check'
      ? 'Missed a possible check'
      : 'Gave a forbidden check';
    return <span className="report-icon missed-check" title={title}>🌭</span>;
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
