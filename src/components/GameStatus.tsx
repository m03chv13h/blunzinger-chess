import type { GameState } from '../core/blunziger/types';
import './GameStatus.css';

interface GameStatusProps {
  state: GameState;
  onReport: () => void;
  botThinking: boolean;
}

export function GameStatus({ state, onReport, botThinking }: GameStatusProps) {
  const { result, sideToMove, invalidReports, config } = state;

  const sideLabel = (s: 'w' | 'b') => (s === 'w' ? 'White' : 'Black');

  return (
    <div className="game-status">
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
        </div>
      ) : (
        <>
          <div className="turn-indicator">
            <span className={`turn-dot ${sideToMove === 'w' ? 'white-dot' : 'black-dot'}`} />
            <span>{sideLabel(sideToMove)} to move</span>
            {botThinking && <span className="thinking">🤔 Thinking...</span>}
          </div>

          <button className="report-btn" onClick={onReport}>
            🚨 Report Missed Check
          </button>
        </>
      )}

      <div className="report-counters">
        <span>Invalid reports — White: {invalidReports.w} / {config.invalidReportLossThreshold}</span>
        <span>Black: {invalidReports.b} / {config.invalidReportLossThreshold}</span>
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
    default:
      return reason;
  }
}
