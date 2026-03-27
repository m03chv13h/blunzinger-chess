/**
 * Blunznforön — the app's strong custom tactical bot for Blunziger + Crazyhouse.
 *
 * Blunznforön is a variant-aware search bot that:
 * - Uses authoritative app-side move generation
 * - Searches legal candidate moves via negamax + alpha-beta pruning
 * - Evaluates positions with full variant awareness
 * - Is especially strong in Crazyhouse + Blunziger combinations
 *
 * PUBLIC API:
 * - selectBlunznforonMove()  — Select best regular move
 * - selectBlunznforonDrop()  — Select best drop move (Crazyhouse)
 * - shouldBlunznforonReport() — Decide whether to report a violation
 * - selectBlunznforonPieceRemoval() — Choose piece for removal penalty
 */

import type {
  Move,
  BotLevel,
  MatchConfig,
  Color,
  CrazyhouseState,
  DropMove,
  ViolationRecord,
  Square,
} from '../../blunziger/types';
import {
  isKingHuntVariant,
  isReverseForcedCheckMode,
} from '../../blunziger/types';
import { isKingOfTheHillEnabled, isHillSquare } from '../../blunziger/engine';
import type { BlunznforonLevel, SearchContext, ScoredMove } from './types';
import { getBlunznforonConfig } from './config';
import { getFilteredCandidates, getViolationMoves } from './blunziger';
import { searchMoves, searchDropMoves } from './search';
import { shouldReport } from './reportLogic';
import { selectPieceForRemoval } from './pieceRemoval';

// ── Level mapping ────────────────────────────────────────────────────

function toBotLevel(level: BotLevel): BlunznforonLevel {
  // Map the app's BotLevel to Blunznforön's level system
  switch (level) {
    case 'easy': return 'easy';
    case 'medium': return 'medium';
    case 'hard': return 'hard';
    default: return 'medium';
  }
}

// ── Build search context ─────────────────────────────────────────────

function buildSearchContext(
  config: MatchConfig,
  side: Color,
  crazyhouse: CrazyhouseState | null,
  scores?: { w: number; b: number },
  plyCount?: number,
): SearchContext {
  return {
    config,
    side,
    crazyhouse,
    kothEnabled: isKingOfTheHillEnabled(config),
    isKingHunt: isKingHuntVariant(config.variantMode),
    isReverse: isReverseForcedCheckMode(config.variantMode),
    kingHuntPliesRemaining: isKingHuntVariant(config.variantMode)
      ? Math.max(0, config.variantSpecific.kingHuntPlyLimit - (plyCount ?? 0))
      : 0,
    scores: scores ?? { w: 0, b: 0 },
  };
}

// ── Select best move ─────────────────────────────────────────────────

/**
 * Select the best regular move for Blunznforön.
 *
 * Pipeline:
 * 1. Filter moves by variant rules
 * 2. Check for easy-bot violations
 * 3. Search and evaluate candidates
 * 4. Apply difficulty-based selection
 *
 * @param fen Current board position
 * @param level Bot difficulty level
 * @param config Match configuration
 * @param side Side to move
 * @param crazyhouse Crazyhouse state (if enabled)
 * @param scores King Hunt scores
 * @param plyCount Current ply count
 * @param whiteMs White clock time
 * @param blackMs Black clock time
 */
export function selectBlunznforonMove(
  fen: string,
  level: BotLevel,
  config: MatchConfig,
  side: Color,
  crazyhouse: CrazyhouseState | null = null,
  scores?: { w: number; b: number },
  plyCount?: number,
  whiteMs: number = 0,
  blackMs: number = 0,
): Move | null {
  const blLevel = toBotLevel(level);
  const blConfig = getBlunznforonConfig(blLevel);
  const ctx = buildSearchContext(config, side, crazyhouse, scores, plyCount);

  // Get variant-filtered candidates
  const { regularMoves } = getFilteredCandidates(fen, config, crazyhouse, side);
  if (regularMoves.length === 0) return null;

  // Easy bot: occasionally make variant violations (checked before single-move return)
  if (blConfig.violationProbability > 0 && Math.random() < blConfig.violationProbability) {
    const violationMoves = getViolationMoves(fen, config);
    if (violationMoves.length > 0) {
      return violationMoves[Math.floor(Math.random() * violationMoves.length)];
    }
  }

  if (regularMoves.length === 1) return regularMoves[0];

  // Check for immediate KOTH wins among candidates
  if (ctx.kothEnabled) {
    const hillWin = regularMoves.find((m) => m.piece === 'k' && isHillSquare(m.to));
    if (hillWin) return hillWin;
  }

  // Easy bot: fast random selection (no deep search for performance)
  if (blLevel === 'easy') {
    return regularMoves[Math.floor(Math.random() * regularMoves.length)];
  }

  // Medium/Hard: search and score all candidate moves
  const scored = searchMoves(fen, regularMoves, blConfig, ctx, whiteMs, blackMs);
  if (scored.length === 0) return regularMoves[0];

  // Apply difficulty-based selection
  return selectFromScored(scored, blConfig);
}

/**
 * Select from scored moves based on difficulty configuration.
 * Higher difficulty = more deterministic (pick the best).
 * Lower difficulty = pick randomly among near-best moves.
 */
function selectFromScored(scored: ScoredMove[], config: { randomMarginCp: number }): Move {
  if (scored.length === 0) throw new Error('No scored moves');

  const bestScore = scored[0].score;
  const margin = config.randomMarginCp;

  // Filter moves within the random margin of the best score
  const candidates = scored.filter((s) => s.score >= bestScore - margin);

  // Pick randomly among candidates
  return candidates[Math.floor(Math.random() * candidates.length)].move;
}

// ── Select best drop move ────────────────────────────────────────────

/**
 * Select the best drop move for Blunznforön (Crazyhouse).
 *
 * Returns a DropMove if a drop is the best action, or null if
 * a regular move is preferred.
 */
export function selectBlunznforonDrop(
  fen: string,
  level: BotLevel,
  config: MatchConfig,
  side: Color,
  crazyhouse: CrazyhouseState,
  scores?: { w: number; b: number },
  plyCount?: number,
  whiteMs: number = 0,
  blackMs: number = 0,
): DropMove | null {
  const blLevel = toBotLevel(level);
  const blConfig = getBlunznforonConfig(blLevel);
  const ctx = buildSearchContext(config, side, crazyhouse, scores, plyCount);

  // Get variant-filtered candidates
  const { regularMoves, dropMoves } = getFilteredCandidates(fen, config, crazyhouse, side);
  if (dropMoves.length === 0) return null;

  // Easy bot: skip drops 50% of the time
  if (blLevel === 'easy' && Math.random() < 0.5) return null;

  // Score drop moves
  const scoredDrops = searchDropMoves(fen, dropMoves, blConfig, ctx, whiteMs, blackMs);
  if (scoredDrops.length === 0) return null;

  // Compare best drop against best regular move
  const bestDropScore = scoredDrops[0].score;

  // If regular moves exist, also score them for comparison
  if (regularMoves.length > 0) {
    const scoredRegular = searchMoves(fen, regularMoves, blConfig, ctx, whiteMs, blackMs);
    if (scoredRegular.length > 0) {
      const bestRegularScore = scoredRegular[0].score;
      // Only drop if the drop is meaningfully better than the best regular move
      if (bestDropScore <= bestRegularScore + 20) {
        return null; // Regular move is at least as good
      }
    }
  }

  // Select from scored drops with difficulty-based randomization
  const margin = blConfig.randomMarginCp;
  const candidates = scoredDrops.filter((s) => s.score >= bestDropScore - margin);
  return candidates[Math.floor(Math.random() * candidates.length)].drop;
}

// ── Report decision ──────────────────────────────────────────────────

/**
 * Determine whether Blunznforön should report an opponent's violation.
 */
export function shouldBlunznforonReport(level: BotLevel, violation: ViolationRecord): boolean {
  return shouldReport(level, violation);
}

// ── Piece removal ────────────────────────────────────────────────────

/**
 * Select the best piece for removal when Blunznforön is the chooser.
 */
export function selectBlunznforonPieceRemoval(
  fen: string,
  targetSide: Color,
  config: MatchConfig,
): Square | null {
  const decision = selectPieceForRemoval(fen, targetSide, config);
  return decision?.square ?? null;
}
