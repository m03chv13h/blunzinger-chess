import type { GameState } from '../core/blunziger/types';
import { isKingHuntVariant } from '../core/blunziger/types';
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

  const isBotTurn =
    state.mode === 'botvbot' ||
    (state.mode === 'hvbot' && sideToMove === state.botColor);
  const showReportButton = config.gameType === 'report_incorrectness' && !isBotTurn;
  const showScores = isKingHuntVariant(config.variantMode);
  const showClocks = config.overlays.enableClock;
  const isKingHuntMoveLimit = config.variantMode === 'classic_king_hunt_move_limit';
  const isKingHuntCheckLimit = config.variantMode === 'classic_king_hunt_given_check_limit';
  const currentPly = state.plyCount;

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

      {/* ── Scores (King Hunt) ── */}
      {showScores && (
        <div className="scores-display">
          <span>♔ White: {scores.w}</span>
          <span>♚ Black: {scores.b}</span>
          {isKingHuntMoveLimit && (
            <span className="move-limit-display">
              Ply {currentPly} / {config.variantSpecific.kingHuntPlyLimit}
            </span>
          )}
          {isKingHuntCheckLimit && (
            <span className="move-limit-display">
              Target: {config.variantSpecific.kingHuntGivenCheckTarget} checks
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
          {config.gameType === 'penalty_on_miss' && config.penaltyConfig.enableAdditionalMovePenalty && (() => {
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
              {state.pendingPieceRemoval.remainingRemovals > 1 &&
                ` (${state.pendingPieceRemoval.remainingRemovals} remaining)`}
            </div>
          )}

          {/* Piece removal mode indicator */}
          {config.gameType === 'penalty_on_miss' && config.penaltyConfig.enablePieceRemovalPenalty && !state.pendingPieceRemoval && !result && (
            <div className="penalty-mode-indicator">♟ Penalty: Piece Removal active</div>
          )}

          {lastReportFeedback && (
            <div className={`report-feedback ${lastReportFeedback.valid ? 'feedback-valid' : 'feedback-invalid'}`}>
              {lastReportFeedback.message}
            </div>
          )}

          {showReportButton && (
            <button className="report-btn" onClick={onReport}>
              🚨 Report Violation
            </button>
          )}
        </>
      )}

      <div className="report-counters">
        {showReportButton && (
          <>
            <span>Invalid reports — White: {invalidReports.w} / {config.reportConfig.invalidReportLossThreshold}</span>
            <span>Black: {invalidReports.b} / {config.reportConfig.invalidReportLossThreshold}</span>
          </>
        )}
        {config.overlays.enableKingOfTheHill && (
          <span className="koth-indicator">👑 King of the Hill enabled</span>
        )}
        {config.overlays.enableCrazyhouse && (
          <span className="koth-indicator">♻ Crazyhouse enabled</span>
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
      return 'Valid report (violation detected)';
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
    case 'timeout':
      return 'Timeout';
    case 'timeout_penalty':
      return 'Timeout (missed move penalty)';
    case 'piece_removal_no_piece_loss':
      return 'No removable pieces (penalty loss)';
    case 'king_hunt_ply_limit':
      return 'King Hunt ply limit reached';
    case 'king_hunt_ply_limit_draw':
      return 'King Hunt ply limit reached (draw)';
    case 'king_hunt_given_check_limit':
      return 'King Hunt given check target reached';
    default:
      return reason;
  }
}
