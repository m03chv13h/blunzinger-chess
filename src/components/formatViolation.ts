import type { MissedCheckEntry } from '../core/blunziger/types';

/** Format available checking moves grouped by category for the tooltip. */
export function formatCategorizedMoves(mc: MissedCheckEntry): string {
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
