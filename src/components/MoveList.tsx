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

  // Group moves into pairs (white, black)
  const pairs: { number: number; white: Move; black?: Move; whiteIdx: number; blackIdx: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
      whiteIdx: i,
      blackIdx: i + 1,
    });
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

  return (
    <div className="move-list">
      <h3>Moves</h3>
      <div className="move-list-content">
        {pairs.length === 0 && <p className="no-moves">No moves yet</p>}
        {pairs.map((pair) => (
          <div key={pair.number} className="move-pair">
            <span className="move-number">{pair.number}.</span>
            <span
              className={[
                'move-white',
                pair.whiteIdx === highlightedMoveIndex ? 'move-active' : '',
                onMoveClick ? 'move-clickable' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleClick(pair.whiteIdx)}
              role={onMoveClick ? 'button' : undefined}
              tabIndex={onMoveClick ? 0 : undefined}
            >
              {pair.white.san}{renderReportIcon(pair.whiteIdx)}{renderMissedCheckIcon(pair.whiteIdx)}
            </span>
            <span
              className={[
                'move-black',
                pair.blackIdx === highlightedMoveIndex ? 'move-active' : '',
                onMoveClick && pair.black ? 'move-clickable' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => pair.black && handleClick(pair.blackIdx)}
              role={onMoveClick && pair.black ? 'button' : undefined}
              tabIndex={onMoveClick && pair.black ? 0 : undefined}
            >
              {pair.black?.san ?? ''}{pair.black && renderReportIcon(pair.blackIdx)}{pair.black && renderMissedCheckIcon(pair.blackIdx)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
