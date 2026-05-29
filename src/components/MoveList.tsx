import { useState, useEffect } from 'react';
import type { Move, ViolationReportEntry, MissedCheckEntry, PieceRemovalEntry, TimeReductionEntry, GspritztReportEntry } from '../core/blunzinger/types';
import { BlutwurstIcon } from './BlutwurstIcon';
import { GspritztIcon } from './GspritztIcon';
import { formatCategorizedMoves } from './formatViolation';
import './MoveList.css';

interface MoveListProps {
  moves: Move[];
  /** Index of the highlighted move in moveHistory, or -1 for none. */
  highlightedMoveIndex?: number;
  /** Called when the user clicks a move in the list. */
  onMoveClick?: (moveIndex: number) => void;
  /** Called when the user presses ArrowLeft to go to the previous move. */
  onNavigatePrev?: () => void;
  /** Called when the user presses ArrowRight to go to the next move. */
  onNavigateNext?: () => void;
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
  /** G'spritzt reports to display as icons next to moves. */
  gspritztReports?: GspritztReportEntry[];
  /** Whether Blunzinger G'spritzt mode is enabled. When true, the blutwurst icon is delayed
   *  by one extra move so it only appears when the violating player has their turn again. */
  gspritztEnabled?: boolean;
  /** When true, the move list starts collapsed and shows only the header. */
  defaultCollapsed?: boolean;
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

export function MoveList({ moves, highlightedMoveIndex = -1, onMoveClick, onNavigatePrev, onNavigateNext, violationReports = [], missedChecks = [], gameOver = false, pieceRemovals = [], timeReductions = [], gspritztReports = [], gspritztEnabled = false, defaultCollapsed = false }: MoveListProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Sync collapsed state when the defaultCollapsed prop changes (e.g. user toggles details panel).
  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  // Arrow key navigation for previous/next move
  useEffect(() => {
    if (!onNavigatePrev && !onNavigateNext) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept arrows when user is typing in an input/textarea
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowLeft' && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      } else if (e.key === 'ArrowRight' && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigatePrev, onNavigateNext]);
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

  // Build a lookup from moveIndex → G'spritzt report for O(1) access
  const gspritztByMove = new Map<number, GspritztReportEntry>();
  for (const gr of gspritztReports) {
    gspritztByMove.set(gr.moveIndex, gr);
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
      ? <span className="report-icon report-valid" aria-label="Correct violation report" data-tooltip="Correct violation report" tabIndex={0}>✅</span>
      : <span className="report-icon report-invalid" aria-label="Incorrect violation report" data-tooltip="Incorrect violation report" tabIndex={0}>❌</span>;
  };

  /**
   * Render blutwurst icon for a missed-check violation, but only once the opponent's
   * next move is complete (or the game is over) so we don't reveal information
   * the opponent could use to report the violation.
   * In G'spritzt mode, delay by one additional move (moveIndex+2) so the icon only
   * appears when the violating player has their turn again — this prevents helping
   * the opponent notice the missed check for reporting purposes.
   */
  const renderMissedCheckIcon = (moveIndex: number) => {
    const mc = missedCheckByMove.get(moveIndex);
    if (!mc) return null;
    // In G'spritzt mode, delay by 2 moves; otherwise delay by 1 move
    const delayMoves = gspritztEnabled ? 2 : 1;
    const isVisible = moves.length > moveIndex + delayMoves || gameOver;
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
    return <span className="report-icon missed-check" aria-label={title} data-tooltip={title} tabIndex={0}><BlutwurstIcon /></span>;
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
      <span key={`pr-${i}`} className="report-icon piece-removal" aria-label="Piece removed (penalty)" data-tooltip="Piece removed (penalty)" tabIndex={0}>
        {pieceSymbol(entry.pieceType, entry.pieceColor)}
      </span>
    ));
  };

  /** Render a time-reduction icon for the given move index. */
  const renderTimeReductionIcon = (moveIndex: number) => {
    const tr = timeReductionByMove.get(moveIndex);
    if (!tr) return null;
    return (
      <span className="report-icon time-reduction" aria-label={`−${tr.seconds}s time penalty`} data-tooltip={`−${tr.seconds}s time penalty`} tabIndex={0}>⏱️</span>
    );
  };

  /** Render a G'spritzt report icon for the given move index. */
  const renderGspritztIcon = (moveIndex: number) => {
    const gr = gspritztByMove.get(moveIndex);
    if (!gr) return null;
    return gr.valid
      ? <span className="report-icon report-valid" aria-label="Correct Blunzinger G'spritzt report" data-tooltip="Correct Blunzinger G'spritzt report" tabIndex={0}><GspritztIcon /> ✅</span>
      : <span className="report-icon report-invalid" aria-label="Incorrect Blunzinger G'spritzt report" data-tooltip="Incorrect Blunzinger G'spritzt report" tabIndex={0}><GspritztIcon /> ❌</span>;
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
        {isExtra && <span className="extra-label" aria-label="Extra move (penalty)" data-tooltip="Extra move (penalty)" tabIndex={0}>&nbsp;⚡</span>}
        {renderReportIcon(moveIndex)}
        {renderMissedCheckIcon(moveIndex)}
        {renderPieceRemovalIcons(moveIndex)}
        {renderTimeReductionIcon(moveIndex)}
        {renderGspritztIcon(moveIndex)}
      </span>
    );
  };

  const isCollapsible = defaultCollapsed;
  const handleHeaderClick = isCollapsible ? () => setCollapsed(c => !c) : undefined;

  return (
    <div className="move-list">
      <h3
        className={`move-list-header${isCollapsible ? ' move-list-header--collapsible' : ''}`}
        onClick={handleHeaderClick}
      >
        Moves {isCollapsible && (collapsed ? '▸' : '▾')}
      </h3>
      {!collapsed && (
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
      )}
    </div>
  );
}
