/**
 * Blunznforön bot — type definitions.
 *
 * Blunznforön is the app's strong custom tactical bot for Blunziger + Crazyhouse.
 * These types define its configuration, search parameters, and evaluation interface.
 */

import type { Move, Square, Color, DropMove, MatchConfig, CrazyhouseState } from '../../blunziger/types';

// ── Difficulty levels ────────────────────────────────────────────────

export type BlunznforonLevel = 'easy' | 'medium' | 'hard' | 'expert';

// ── Search configuration per difficulty ──────────────────────────────

export interface BlunznforonConfig {
  /** Base negamax search depth (half-moves). */
  searchDepth: number;
  /** Additional depth for quiescence search (captures/checks at leaf). */
  quiescenceDepth: number;
  /**
   * Randomization among top moves.  0 = fully deterministic (pick best),
   * higher values = more random among close-to-best candidates.
   * Expressed as centipawn tolerance: moves within this margin of the best
   * are considered equally good.
   */
  randomMarginCp: number;
  /** Probability that easy bot makes a variant-rule violation. */
  violationProbability: number;
  /** Whether to apply tactical extensions (extend search in check/capture). */
  useTacticalExtensions: boolean;
}

// ── Scored move for search results ───────────────────────────────────

export interface ScoredMove {
  move: Move;
  score: number;
}

export interface ScoredDrop {
  drop: DropMove;
  score: number;
}

// ── Search context passed through the search tree ────────────────────

export interface SearchContext {
  config: MatchConfig;
  side: Color;
  crazyhouse: CrazyhouseState | null;
  kothEnabled: boolean;
  isKingHunt: boolean;
  isReverse: boolean;
  /** Remaining plies for King Hunt ply limit mode. */
  kingHuntPliesRemaining: number;
  /** Current scores for King Hunt modes. */
  scores: { w: number; b: number };
}

// ── Piece removal decision result ────────────────────────────────────

export interface PieceRemovalDecision {
  square: Square;
  score: number;
}
