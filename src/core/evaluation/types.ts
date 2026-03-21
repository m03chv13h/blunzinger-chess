/**
 * Evaluation result type for the variant-aware evaluation bar.
 *
 * The score is always from White's perspective:
 *   positive = White is better,  negative = Black is better.
 */
export interface EvaluationResult {
  /** Centipawn-like score (positive = White better). */
  scoreCp: number;
  /** Mate-in-N if detected (positive = White mates, negative = Black mates). */
  mateIn: number | null;
  /** Which side is favored. */
  favoredSide: 'white' | 'black' | 'equal';
  /**
   * Score clamped to [-1, 1] for bar rendering.
   * +1 = decisive White advantage, -1 = decisive Black advantage, 0 = equal.
   */
  normalizedScore: number;
  /**
   * Best theoretical next move in SAN notation (e.g. "Nf3"), or "Report" if
   * reporting the opponent's violation is the best action.  null when the game
   * is over or no moves are available.
   */
  bestMove: string | null;
  /**
   * Human-readable explanation lines (for debug / tooltip).
   * Each line describes one evaluation component.
   */
  explanation: string[];
}
