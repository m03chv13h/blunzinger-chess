import type { EvaluationResult } from '../core/evaluation/types';
import './EvaluationBar.css';

interface EvaluationBarProps {
  evaluation: EvaluationResult;
}

/**
 * Vertical evaluation bar showing which side is currently better.
 *
 * - More White area (bottom) → White is better
 * - More Black area (top)    → Black is better
 *
 * The bar is read-only and purely informational.
 * When available, it also displays the best theoretical next move.
 */
export function EvaluationBar({ evaluation }: EvaluationBarProps) {
  const { normalizedScore, scoreCp, mateIn, favoredSide, bestMove } = evaluation;

  // Convert normalized score [-1, 1] to white percentage [0%, 100%].
  // normalizedScore +1 = decisive White → 100% white area.
  // normalizedScore -1 = decisive Black → 0% white area (100% black area).
  const whitePct = Math.round(((normalizedScore + 1) / 2) * 100);

  // Format score label.
  let label: string;
  if (mateIn !== null) {
    label = mateIn === 0
      ? '#'
      : `M${Math.abs(mateIn)}`;
  } else if (Math.abs(scoreCp) >= 9999) {
    // Decisive non-mate advantage (e.g. Report wins the game).
    label = '#';
  } else {
    const pawns = Math.abs(scoreCp) / 100;
    if (pawns < 0.1) {
      label = '0.0';
    } else {
      label = pawns.toFixed(1);
    }
  }

  const scorePrefix = favoredSide === 'equal' ? '' : favoredSide === 'white' ? '+' : '-';

  // Append best move to the visible label when available.
  const displayLabel = bestMove
    ? `${scorePrefix}${label} ${bestMove}`
    : `${scorePrefix}${label}`;

  const tooltip = [
    'Variant-aware evaluation estimate',
    `Score: ${scorePrefix}${label}`,
    ...(bestMove ? [`Best move: ${bestMove}`] : []),
    ...evaluation.explanation.slice(0, 5),
  ].join('\n');

  return (
    <div className="eval-bar" title={tooltip} aria-label={`Evaluation: ${scorePrefix}${label}${bestMove ? `, best move: ${bestMove}` : ''}`}>
      <div className="eval-bar-black" style={{ height: `${100 - whitePct}%` }} />
      <div className="eval-bar-white" style={{ height: `${whitePct}%` }} />
      <span className="eval-bar-label">{displayLabel}</span>
    </div>
  );
}
