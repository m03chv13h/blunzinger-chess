import type { GameState } from '../core/blunziger/types';
import './GameStatus.css';

interface GameStatusProps {
  state: GameState;
  onReport: () => void;
  botThinking: boolean;
  clockWhiteMs?: number;
  clockBlackMs?: number;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function GameStatus({ state, onReport, botThinking, clockWhiteMs, clockBlackMs }: GameStatusProps) {
  const { result, sideToMove, invalidReports, config, lastReportFeedback, scores } = state;

  const sideLabel = (s: 'w' | 'b') => (s === 'w' ? 'White' : 'Black');

  const showReportButton =
    config.enableBlunziger &&
    !config.reverseForcedCheck &&
    !(config.enableExtraMovePenalty || config.enablePieceRemovalPenalty || config.enableTimeReductionPenalty);

  const showScores = config.scoringMode === 'checks_count';
  const showClocks = config.enableClock;
  const showMoveLimit = config.moveLimit > 0;
  const currentFullMove = Math.floor(state.plyCount / 2) + 1;

  return (
    <div className="game-status">
      {/* ── Clocks ── */}
      {showClocks && (
        <div className="clocks-display">
          <div className={`clock ${sideToMove === 'b' && !result ? 'clock-active' : ''}`}>
            ♚ {formatClock(clockBlackMs ?? 0)}
          </div>
          <div className={`clock ${sideToMove === 'w' && !result ? 'clock-active' : ''}`}>
            ♔ {formatClock(clockWhiteMs ?? 0)}
          </div>
        </div>
      )}

      {/* ── Scores (King Hunter) ── */}
      {showScores && (
        <div className="scores-display">
          <span>♔ White: {scores.w}</span>
          <span>♚ Black: {scores.b}</span>
          {showMoveLimit && (
            <span className="move-limit-display">
              Move {currentFullMove} / {config.moveLimit}
            </span>
          )}
        </div>
      )}

      {result ? (
        <div className="result-panel">
          <h2 className="result-title">Game Over!</h2>
          <p className="result-winner">
            {result.winner === 'draw' ? '½-½ Draw' : `${sideLabel(result.winner)} wins!`}
          </p>
          <p className="result-reason">
            Reason: <strong>{formatReason(result.reason)}</strong>
          </p>
          {result.detail && <p className="result-detail">{result.detail}</p>}
          {lastReportFeedback && (
            <div className={`report-feedback ${lastReportFeedback.valid ? 'feedback-valid' : 'feedback-invalid'}`}>
              {lastReportFeedback.message}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="turn-indicator">
            <span className={`turn-dot ${sideToMove === 'w' ? 'white-dot' : 'black-dot'}`} />
            <span>{sideLabel(sideToMove)} to move</span>
            {botThinking && <span className="thinking">🤔 Thinking...</span>}
          </div>

          {/* Extra-turn indicator */}
          {config.enableExtraMovePenalty && (() => {
            const { pendingExtraMovesWhite: ew, pendingExtraMovesBlack: eb } = state.extraTurns;
            if (ew <= 0 && eb <= 0) return null;
            const msg = ew > 0
              ? `White has ${ew} extra turn(s)`
              : `Black has ${eb} extra turn(s)`;
            return <div className="extra-turn-indicator">⚡ {msg}</div>;
          })()}

          {/* Piece removal prompt */}
          {state.pendingPieceRemoval && (
            <div className="piece-removal-indicator">
              🎯 {state.pendingPieceRemoval.chooserSide === 'w' ? 'White' : 'Black'} must choose a{' '}
              {state.pendingPieceRemoval.targetSide === 'w' ? 'White' : 'Black'} piece to remove
            </div>
          )}

          {/* Piece removal mode indicator */}
          {config.enablePieceRemovalPenalty && !state.pendingPieceRemoval && !result && (
            <div className="penalty-mode-indicator">♟ Penalty: Piece Removal active</div>
          )}

          {lastReportFeedback && (
            <div className={`report-feedback ${lastReportFeedback.valid ? 'feedback-valid' : 'feedback-invalid'}`}>
              {lastReportFeedback.message}
            </div>
          )}

          {showReportButton && (
            <button className="report-btn" onClick={onReport}>
              🚨 Report Missed Check
            </button>
          )}
        </>
      )}

      <div className="report-counters">
        {showReportButton && (
          <>
            <span>Invalid reports — White: {invalidReports.w} / {config.invalidReportLossThreshold}</span>
            <span>Black: {invalidReports.b} / {config.invalidReportLossThreshold}</span>
          </>
        )}
        {config.enableKingOfTheHill && (
          <span className="koth-indicator">👑 King of the Hill enabled</span>
        )}
      </div>
    </div>
  );
}

function formatReason(reason: string): string {
  switch (reason) {
    case 'checkmate':
      return 'Checkmate';
    case 'stalemate':
      return 'Stalemate';
    case 'valid-report':
      return 'Missed forced check (valid report)';
    case 'invalid-report-threshold':
      return 'Too many invalid reports';
    case 'draw':
      return 'Draw';
    case 'insufficient-material':
      return 'Insufficient material';
    case 'threefold-repetition':
      return 'Threefold repetition';
    case 'fifty-move-rule':
      return 'Fifty-move rule';
    case 'king_of_the_hill':
      return 'King of the Hill';
    case 'double_check_pressure_violation':
      return 'Double Check Pressure violation';
    case 'reverse_blunziger_violation':
      return 'Reverse Blunziger violation';
    case 'timeout':
      return 'Timeout';
    case 'timeout_penalty':
      return 'Timeout (missed check penalty)';
    case 'piece_removal_no_piece_loss':
      return 'No removable pieces (penalty loss)';
    case 'score_limit':
      return 'Score limit reached';
    case 'score_limit_draw':
      return 'Score limit reached (draw)';
    default:
      return reason;
  }
}
