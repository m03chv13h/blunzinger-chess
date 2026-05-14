/**
 * Mapping utilities between gRPC protobuf messages and TypeScript core types.
 *
 * The Node worker receives protobuf-like plain objects from @grpc/proto-loader
 * and needs to convert them to/from the core TypeScript types used by the
 * game engine.
 */

import type {
  Color,
  Move,
  Square,
  VariantMode,
  GameType,
  GameMode,
  BotLevel,
  MatchConfig,
  OverlayConfig,
  ReportGameTypeConfig,
  PenaltyGameTypeConfig,
  VariantSpecificConfig,
  GameState,
  ViolationRecord,
  ViolationType,
  GameResult,
  GameResultReason,
  ScoreState,
  ClockState,
  ExtraTurnState,
  InvalidReportCounts,
  ReportFeedback,
  PendingPieceRemoval,
  CrazyhouseState,
  PlayerReserve,
  PositionHistoryEntry,
  ViolationReportEntry,
  MissedCheckEntry,
  PieceRemovalEntry,
  TimeReductionEntry,
  DropMove,
  CrazyhousePieceType,
  GameSetupConfig,
} from '../../../src/core/blunzinger/types.js';
import type { Chess960State } from '../../../src/core/blunzinger/chess960.js';
import type { EngineId } from '../../../src/core/engine/types.js';

// ── Proto enum → TS type maps ────────────────────────────────────────

const PROTO_COLOR_TO_TS: Record<number, Color> = { 1: 'w', 2: 'b' };
const TS_COLOR_TO_PROTO: Record<string, number> = { w: 1, b: 2 };

const PROTO_VARIANT_TO_TS: Record<number, VariantMode> = {
  1: 'classic_blunzinger',
  2: 'reverse_blunzinger',
  3: 'classic_king_hunt_move_limit',
  4: 'classic_king_hunt_given_check_limit',
};
const TS_VARIANT_TO_PROTO: Record<string, number> = {
  classic_blunzinger: 1,
  reverse_blunzinger: 2,
  classic_king_hunt_move_limit: 3,
  classic_king_hunt_given_check_limit: 4,
};

const PROTO_GAME_TYPE_TO_TS: Record<number, GameType> = {
  1: 'report_incorrectness',
  2: 'penalty_on_miss',
};
const TS_GAME_TYPE_TO_PROTO: Record<string, number> = {
  report_incorrectness: 1,
  penalty_on_miss: 2,
};

const PROTO_GAME_MODE_TO_TS: Record<number, GameMode> = {
  1: 'hvh',
  2: 'hvbot',
  3: 'botvbot',
};
const TS_GAME_MODE_TO_PROTO: Record<string, number> = {
  hvh: 1,
  hvbot: 2,
  botvbot: 3,
};

const PROTO_BOT_LEVEL_TO_TS: Record<number, BotLevel> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
};
const TS_BOT_LEVEL_TO_PROTO: Record<string, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const PROTO_ENGINE_TO_TS: Record<number, EngineId> = {
  1: 'heuristic',
  2: 'blunznforön',
  3: 'blunznfish',
};
const TS_ENGINE_TO_PROTO: Record<string, number> = {
  heuristic: 1,
  'blunznforön': 2,
  blunznfish: 3,
};

const PROTO_VIOLATION_TYPE_TO_TS: Record<number, ViolationType> = {
  1: 'missed_check',
  2: 'gave_forbidden_check',
  3: 'missed_check_removal',
  4: 'gave_forbidden_check_removal',
};
const TS_VIOLATION_TYPE_TO_PROTO: Record<string, number> = {
  missed_check: 1,
  gave_forbidden_check: 2,
  missed_check_removal: 3,
  gave_forbidden_check_removal: 4,
};

const PROTO_REASON_TO_TS: Record<number, GameResultReason> = {
  1: 'checkmate',
  2: 'stalemate',
  3: 'draw',
  4: 'valid-report',
  5: 'invalid-report-threshold',
  6: 'resignation',
  7: 'insufficient-material',
  8: 'threefold-repetition',
  9: 'fifty-move-rule',
  10: 'king_of_the_hill',
  11: 'double_check_pressure_violation',
  12: 'timeout',
  13: 'timeout_penalty',
  14: 'king_hunt_ply_limit',
  15: 'king_hunt_ply_limit_draw',
  16: 'king_hunt_given_check_limit',
  17: 'piece_removal_no_piece_loss',
  18: 'atomic_king_explosion',
};
const TS_REASON_TO_PROTO: Record<string, number> = {
  checkmate: 1,
  stalemate: 2,
  draw: 3,
  'valid-report': 4,
  'invalid-report-threshold': 5,
  resignation: 6,
  'insufficient-material': 7,
  'threefold-repetition': 8,
  'fifty-move-rule': 9,
  king_of_the_hill: 10,
  double_check_pressure_violation: 11,
  timeout: 12,
  timeout_penalty: 13,
  king_hunt_ply_limit: 14,
  king_hunt_ply_limit_draw: 15,
  king_hunt_given_check_limit: 16,
  piece_removal_no_piece_loss: 17,
  atomic_king_explosion: 18,
};

// ── Proto → TS converters ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProtoMsg = any;

export function protoToColor(val: number): Color {
  return PROTO_COLOR_TO_TS[val] ?? 'w';
}

export function colorToProto(val: Color): number {
  return TS_COLOR_TO_PROTO[val] ?? 1;
}

export function protoToVariantMode(val: number): VariantMode {
  return PROTO_VARIANT_TO_TS[val] ?? 'classic_blunzinger';
}

export function protoToGameType(val: number): GameType {
  return PROTO_GAME_TYPE_TO_TS[val] ?? 'report_incorrectness';
}

export function protoToGameMode(val: number): GameMode {
  return PROTO_GAME_MODE_TO_TS[val] ?? 'hvh';
}

export function protoToBotLevel(val: number): BotLevel {
  return PROTO_BOT_LEVEL_TO_TS[val] ?? 'easy';
}

export function protoToEngineId(val: number): EngineId {
  return PROTO_ENGINE_TO_TS[val] ?? 'heuristic';
}

export function protoToViolationType(val: number): ViolationType {
  return PROTO_VIOLATION_TYPE_TO_TS[val] ?? 'missed_check';
}

export function protoToMove(pm: ProtoMsg): Move {
  return {
    from: pm.from as Square,
    to: pm.to as Square,
    san: pm.san ?? '',
    promotion: pm.promotion || undefined,
    color: pm.color as Color,
    piece: pm.piece,
    captured: pm.captured || undefined,
    flags: pm.flags ?? '',
    lan: pm.lan ?? '',
    before: pm.before ?? '',
    after: pm.after ?? '',
  } as Move;
}

export function moveToProto(m: Move): ProtoMsg {
  return {
    from: m.from,
    to: m.to,
    san: m.san,
    promotion: m.promotion || '',
    color: m.color,
    piece: m.piece,
    captured: m.captured || '',
    flags: m.flags,
    lan: m.lan,
    before: m.before,
    after: m.after,
  };
}

export function protoToDropMove(pm: ProtoMsg): DropMove {
  return {
    type: 'drop',
    piece: pm.piece as CrazyhousePieceType,
    to: pm.to as Square,
    color: pm.color as Color,
  };
}

export function dropMoveToProto(d: DropMove): ProtoMsg {
  return {
    piece: d.piece,
    to: d.to,
    color: d.color,
  };
}

export function protoToPlayerReserve(pm: ProtoMsg): PlayerReserve {
  return {
    p: pm?.p ?? 0,
    n: pm?.n ?? 0,
    b: pm?.b ?? 0,
    r: pm?.r ?? 0,
    q: pm?.q ?? 0,
  };
}

export function playerReserveToProto(r: PlayerReserve): ProtoMsg {
  return { p: r.p, n: r.n, b: r.b, r: r.r, q: r.q };
}

export function protoToCrazyhouseState(pm: ProtoMsg): CrazyhouseState | null {
  if (!pm) return null;
  return {
    whiteReserve: protoToPlayerReserve(pm.white_reserve),
    blackReserve: protoToPlayerReserve(pm.black_reserve),
  };
}

export function crazyhouseStateToProto(cs: CrazyhouseState | null): ProtoMsg | null {
  if (!cs) return null;
  return {
    white_reserve: playerReserveToProto(cs.whiteReserve),
    black_reserve: playerReserveToProto(cs.blackReserve),
  };
}

export function protoToChess960State(pm: ProtoMsg): Chess960State | null {
  if (!pm?.json_data) return null;
  return JSON.parse(pm.json_data) as Chess960State;
}

export function chess960StateToProto(cs: Chess960State | null): ProtoMsg | null {
  if (!cs) return null;
  return { json_data: JSON.stringify(cs) };
}

export function protoToOverlayConfig(pm: ProtoMsg): OverlayConfig {
  return {
    enableKingOfTheHill: pm.enable_king_of_the_hill ?? false,
    enableClock: pm.enable_clock ?? false,
    initialTimeMs: pm.initial_time_ms ?? 0,
    incrementMs: pm.increment_ms ?? 0,
    decrementMs: pm.decrement_ms ?? 0,
    enableDoubleCheckPressure: pm.enable_double_check_pressure ?? false,
    enableCrazyhouse: pm.enable_crazyhouse ?? false,
    enableChess960: pm.enable_chess960 ?? false,
    enableAtomic: pm.enable_atomic ?? false,
  };
}

export function overlayConfigToProto(oc: OverlayConfig): ProtoMsg {
  return {
    enable_king_of_the_hill: oc.enableKingOfTheHill,
    enable_clock: oc.enableClock,
    initial_time_ms: oc.initialTimeMs,
    increment_ms: oc.incrementMs,
    decrement_ms: oc.decrementMs,
    enable_double_check_pressure: oc.enableDoubleCheckPressure,
    enable_crazyhouse: oc.enableCrazyhouse,
    enable_chess960: oc.enableChess960,
    enable_atomic: oc.enableAtomic,
  };
}

export function protoToReportConfig(pm: ProtoMsg): ReportGameTypeConfig {
  return {
    invalidReportLossThreshold: pm?.invalid_report_loss_threshold ?? 2,
    enableGspritzt: pm?.enable_gspritzt ?? false,
    gspritztInvalidReportLossThreshold: pm?.gspritzt_invalid_report_loss_threshold ?? 2,
  };
}

export function protoToPenaltyConfig(pm: ProtoMsg): PenaltyGameTypeConfig {
  return {
    enableAdditionalMovePenalty: pm?.enable_additional_move_penalty ?? false,
    additionalMoveCount: pm?.additional_move_count ?? 1,
    enablePieceRemovalPenalty: pm?.enable_piece_removal_penalty ?? false,
    pieceRemovalCount: pm?.piece_removal_count ?? 1,
    enableTimeReductionPenalty: pm?.enable_time_reduction_penalty ?? false,
    timeReductionSeconds: pm?.time_reduction_seconds ?? 60,
  };
}

export function protoToVariantSpecificConfig(pm: ProtoMsg): VariantSpecificConfig {
  return {
    kingHuntPlyLimit: pm?.king_hunt_ply_limit ?? 80,
    kingHuntGivenCheckTarget: pm?.king_hunt_given_check_target ?? 5,
  };
}

export function protoToMatchConfig(pm: ProtoMsg): MatchConfig {
  return {
    variantMode: protoToVariantMode(pm.variant_mode),
    gameType: protoToGameType(pm.game_type),
    overlays: protoToOverlayConfig(pm.overlays),
    reportConfig: protoToReportConfig(pm.report_config),
    penaltyConfig: protoToPenaltyConfig(pm.penalty_config),
    variantSpecific: protoToVariantSpecificConfig(pm.variant_specific),
    initialFen: pm.initial_fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    chess960Index: pm.chess960_index ?? undefined,
  };
}

export function matchConfigToProto(mc: MatchConfig): ProtoMsg {
  return {
    variant_mode: TS_VARIANT_TO_PROTO[mc.variantMode],
    game_type: TS_GAME_TYPE_TO_PROTO[mc.gameType],
    overlays: overlayConfigToProto(mc.overlays),
    report_config: {
      invalid_report_loss_threshold: mc.reportConfig.invalidReportLossThreshold,
      enable_gspritzt: mc.reportConfig.enableGspritzt,
      gspritzt_invalid_report_loss_threshold: mc.reportConfig.gspritztInvalidReportLossThreshold,
    },
    penalty_config: {
      enable_additional_move_penalty: mc.penaltyConfig.enableAdditionalMovePenalty,
      additional_move_count: mc.penaltyConfig.additionalMoveCount,
      enable_piece_removal_penalty: mc.penaltyConfig.enablePieceRemovalPenalty,
      piece_removal_count: mc.penaltyConfig.pieceRemovalCount,
      enable_time_reduction_penalty: mc.penaltyConfig.enableTimeReductionPenalty,
      time_reduction_seconds: mc.penaltyConfig.timeReductionSeconds,
    },
    variant_specific: {
      king_hunt_ply_limit: mc.variantSpecific.kingHuntPlyLimit,
      king_hunt_given_check_target: mc.variantSpecific.kingHuntGivenCheckTarget,
    },
    initial_fen: mc.initialFen,
    chess960_index: mc.chess960Index ?? null,
  };
}

export function protoToScoreState(pm: ProtoMsg): ScoreState {
  return { w: pm?.w ?? 0, b: pm?.b ?? 0 };
}

export function scoreStateToProto(ss: ScoreState): ProtoMsg {
  return { w: ss.w, b: ss.b };
}

export function protoToClockState(pm: ProtoMsg): ClockState | null {
  if (!pm) return null;
  return {
    whiteMs: Number(pm.white_ms ?? 0),
    blackMs: Number(pm.black_ms ?? 0),
    lastTimestamp: pm.last_timestamp != null ? Number(pm.last_timestamp) : null,
  };
}

export function clockStateToProto(cs: ClockState | null): ProtoMsg | null {
  if (!cs) return null;
  return {
    white_ms: cs.whiteMs,
    black_ms: cs.blackMs,
    last_timestamp: cs.lastTimestamp,
  };
}

export function protoToExtraTurnState(pm: ProtoMsg): ExtraTurnState {
  return {
    pendingExtraMovesWhite: pm?.pending_extra_moves_white ?? 0,
    pendingExtraMovesBlack: pm?.pending_extra_moves_black ?? 0,
  };
}

export function protoToInvalidReportCounts(pm: ProtoMsg): InvalidReportCounts {
  return { w: pm?.w ?? 0, b: pm?.b ?? 0 };
}

export function protoToGameResult(pm: ProtoMsg): GameResult | null {
  if (!pm) return null;
  return {
    winner: pm.winner as Color | 'draw',
    reason: PROTO_REASON_TO_TS[pm.reason] ?? 'checkmate',
    detail: pm.detail || undefined,
  };
}

export function gameResultToProto(gr: GameResult | null): ProtoMsg | null {
  if (!gr) return null;
  return {
    winner: gr.winner,
    reason: TS_REASON_TO_PROTO[gr.reason] ?? 1,
    detail: gr.detail ?? '',
  };
}

export function protoToReportFeedback(pm: ProtoMsg): ReportFeedback | null {
  if (!pm) return null;
  return { valid: pm.valid ?? false, message: pm.message ?? '' };
}

export function reportFeedbackToProto(rf: ReportFeedback | null): ProtoMsg | null {
  if (!rf) return null;
  return { valid: rf.valid, message: rf.message };
}

export function protoToViolationRecord(pm: ProtoMsg): ViolationRecord | null {
  if (!pm) return null;
  return {
    violatingSide: protoToColor(pm.violating_side),
    moveIndex: pm.move_index ?? 0,
    fenBeforeMove: pm.fen_before_move ?? '',
    checkingMoves: (pm.checking_moves ?? []).map(protoToMove),
    requiredMoves: (pm.required_moves ?? []).map(protoToMove),
    actualMove: pm.actual_move ? protoToMove(pm.actual_move) : undefined,
    reportable: pm.reportable ?? false,
    violationType: protoToViolationType(pm.violation_type),
    severe: pm.severe ?? false,
    requiredRemovalSquares: pm.required_removal_squares?.length
      ? pm.required_removal_squares as Square[]
      : undefined,
    chosenRemovalSquare: pm.chosen_removal_square || undefined,
    checkingDropMoves: pm.checking_drop_moves?.length
      ? pm.checking_drop_moves.map(protoToDropMove)
      : undefined,
    requiredDropMoves: pm.required_drop_moves?.length
      ? pm.required_drop_moves.map(protoToDropMove)
      : undefined,
  };
}

export function violationRecordToProto(vr: ViolationRecord | null): ProtoMsg | null {
  if (!vr) return null;
  return {
    violating_side: TS_COLOR_TO_PROTO[vr.violatingSide],
    move_index: vr.moveIndex,
    fen_before_move: vr.fenBeforeMove,
    checking_moves: vr.checkingMoves.map(moveToProto),
    required_moves: vr.requiredMoves.map(moveToProto),
    actual_move: vr.actualMove ? moveToProto(vr.actualMove) : null,
    reportable: vr.reportable,
    violation_type: TS_VIOLATION_TYPE_TO_PROTO[vr.violationType],
    severe: vr.severe,
    required_removal_squares: vr.requiredRemovalSquares ?? [],
    chosen_removal_square: vr.chosenRemovalSquare ?? '',
    checking_drop_moves: vr.checkingDropMoves?.map(dropMoveToProto) ?? [],
    required_drop_moves: vr.requiredDropMoves?.map(dropMoveToProto) ?? [],
  };
}

export function protoToPendingPieceRemoval(pm: ProtoMsg): PendingPieceRemoval | null {
  if (!pm) return null;
  return {
    targetSide: protoToColor(pm.target_side),
    chooserSide: protoToColor(pm.chooser_side),
    removableSquares: (pm.removable_squares ?? []) as Square[],
    remainingRemovals: pm.remaining_removals ?? 0,
    triggerMoveIndex: pm.trigger_move_index ?? 0,
  };
}

export function pendingPieceRemovalToProto(ppr: PendingPieceRemoval | null): ProtoMsg | null {
  if (!ppr) return null;
  return {
    target_side: TS_COLOR_TO_PROTO[ppr.targetSide],
    chooser_side: TS_COLOR_TO_PROTO[ppr.chooserSide],
    removable_squares: ppr.removableSquares,
    remaining_removals: ppr.remainingRemovals,
    trigger_move_index: ppr.triggerMoveIndex,
  };
}

export function protoToPositionHistoryEntry(pm: ProtoMsg): PositionHistoryEntry {
  return {
    fen: pm.fen ?? '',
    scores: protoToScoreState(pm.scores),
    moveNotation: pm.move_notation ?? null,
    crazyhouse: pm.crazyhouse ? protoToCrazyhouseState(pm.crazyhouse) ?? undefined : undefined,
    chess960: pm.chess960 ? protoToChess960State(pm.chess960) ?? undefined : undefined,
    clockWhiteMs: pm.clock_white_ms != null ? Number(pm.clock_white_ms) : undefined,
    clockBlackMs: pm.clock_black_ms != null ? Number(pm.clock_black_ms) : undefined,
  };
}

export function positionHistoryEntryToProto(phe: PositionHistoryEntry): ProtoMsg {
  return {
    fen: phe.fen,
    scores: scoreStateToProto(phe.scores),
    move_notation: phe.moveNotation ?? '',
    crazyhouse: phe.crazyhouse ? crazyhouseStateToProto(phe.crazyhouse) : null,
    chess960: phe.chess960 ? chess960StateToProto(phe.chess960 as Chess960State) : null,
    clock_white_ms: phe.clockWhiteMs ?? null,
    clock_black_ms: phe.clockBlackMs ?? null,
  };
}

export function protoToViolationReportEntry(pm: ProtoMsg): ViolationReportEntry {
  return {
    moveIndex: pm.move_index ?? 0,
    reportingSide: protoToColor(pm.reporting_side),
    valid: pm.valid ?? false,
  };
}

export function protoToMissedCheckEntry(pm: ProtoMsg): MissedCheckEntry {
  return {
    moveIndex: pm.move_index ?? 0,
    violationType: protoToViolationType(pm.violation_type),
    availableMoves: pm.available_moves ?? [],
    availableRegularMoves: pm.available_regular_moves?.length ? pm.available_regular_moves : undefined,
    availableDropMoves: pm.available_drop_moves?.length ? pm.available_drop_moves : undefined,
    availableRemovalSquares: pm.available_removal_squares?.length ? pm.available_removal_squares : undefined,
    isAdditionalMove: pm.is_additional_move || undefined,
  };
}

export function protoToPieceRemovalEntry(pm: ProtoMsg): PieceRemovalEntry {
  return {
    moveIndex: pm.move_index ?? 0,
    pieceType: pm.piece_type ?? '',
    pieceColor: pm.piece_color as Color,
  };
}

export function protoToTimeReductionEntry(pm: ProtoMsg): TimeReductionEntry {
  return {
    moveIndex: pm.move_index ?? 0,
    seconds: pm.seconds ?? 0,
  };
}

// ── Full GameState conversion ────────────────────────────────────────

export function protoToGameState(pm: ProtoMsg): GameState {
  return {
    fen: pm.fen ?? '',
    moveHistory: (pm.move_history ?? []).map(protoToMove),
    sideToMove: protoToColor(pm.side_to_move),
    pendingViolation: protoToViolationRecord(pm.pending_violation),
    invalidReports: protoToInvalidReportCounts(pm.invalid_reports),
    config: protoToMatchConfig(pm.config),
    result: protoToGameResult(pm.result),
    lastReportFeedback: protoToReportFeedback(pm.last_report_feedback),
    mode: protoToGameMode(pm.mode),
    botLevel: protoToBotLevel(pm.bot_level),
    botLevelWhite: protoToBotLevel(pm.bot_level_white),
    botLevelBlack: protoToBotLevel(pm.bot_level_black),
    botColor: protoToColor(pm.bot_color),
    engineIdWhite: protoToEngineId(pm.engine_id_white),
    engineIdBlack: protoToEngineId(pm.engine_id_black),
    scores: protoToScoreState(pm.scores),
    clocks: protoToClockState(pm.clocks),
    extraTurns: protoToExtraTurnState(pm.extra_turns),
    pendingPieceRemoval: protoToPendingPieceRemoval(pm.pending_piece_removal),
    plyCount: pm.ply_count ?? 0,
    positionHistory: (pm.position_history ?? []).map(protoToPositionHistoryEntry),
    violationReports: (pm.violation_reports ?? []).map(protoToViolationReportEntry),
    lastExpiredViolation: protoToViolationRecord(pm.last_expired_violation),
    invalidGspritztReports: protoToInvalidReportCounts(pm.invalid_gspritzt_reports),
    gspritztReports: (pm.gspritzt_reports ?? []).map(protoToViolationReportEntry),
    missedChecks: (pm.missed_checks ?? []).map(protoToMissedCheckEntry),
    pieceRemovals: (pm.piece_removals ?? []).map(protoToPieceRemovalEntry),
    timeReductions: (pm.time_reductions ?? []).map(protoToTimeReductionEntry),
    inExtraTurn: pm.in_extra_turn ?? false,
    crazyhouse: protoToCrazyhouseState(pm.crazyhouse),
    chess960: protoToChess960State(pm.chess960),
  };
}

export function gameStateToProto(gs: GameState): ProtoMsg {
  return {
    fen: gs.fen,
    move_history: gs.moveHistory.map(moveToProto),
    side_to_move: TS_COLOR_TO_PROTO[gs.sideToMove],
    pending_violation: violationRecordToProto(gs.pendingViolation),
    invalid_reports: { w: gs.invalidReports.w, b: gs.invalidReports.b },
    config: matchConfigToProto(gs.config),
    result: gameResultToProto(gs.result),
    last_report_feedback: reportFeedbackToProto(gs.lastReportFeedback),
    mode: TS_GAME_MODE_TO_PROTO[gs.mode],
    bot_level: TS_BOT_LEVEL_TO_PROTO[gs.botLevel],
    bot_level_white: TS_BOT_LEVEL_TO_PROTO[gs.botLevelWhite],
    bot_level_black: TS_BOT_LEVEL_TO_PROTO[gs.botLevelBlack],
    bot_color: TS_COLOR_TO_PROTO[gs.botColor],
    engine_id_white: TS_ENGINE_TO_PROTO[gs.engineIdWhite],
    engine_id_black: TS_ENGINE_TO_PROTO[gs.engineIdBlack],
    scores: scoreStateToProto(gs.scores),
    clocks: clockStateToProto(gs.clocks),
    extra_turns: {
      pending_extra_moves_white: gs.extraTurns.pendingExtraMovesWhite,
      pending_extra_moves_black: gs.extraTurns.pendingExtraMovesBlack,
    },
    pending_piece_removal: pendingPieceRemovalToProto(gs.pendingPieceRemoval),
    ply_count: gs.plyCount,
    position_history: gs.positionHistory.map(positionHistoryEntryToProto),
    violation_reports: gs.violationReports.map((vr) => ({
      move_index: vr.moveIndex,
      reporting_side: TS_COLOR_TO_PROTO[vr.reportingSide],
      valid: vr.valid,
    })),
    last_expired_violation: violationRecordToProto(gs.lastExpiredViolation),
    invalid_gspritzt_reports: { w: gs.invalidGspritztReports.w, b: gs.invalidGspritztReports.b },
    gspritzt_reports: gs.gspritztReports.map((gr) => ({
      move_index: gr.moveIndex,
      reporting_side: TS_COLOR_TO_PROTO[gr.reportingSide],
      valid: gr.valid,
    })),
    missed_checks: gs.missedChecks.map((mc) => ({
      move_index: mc.moveIndex,
      violation_type: TS_VIOLATION_TYPE_TO_PROTO[mc.violationType],
      available_moves: mc.availableMoves,
      available_regular_moves: mc.availableRegularMoves ?? [],
      available_drop_moves: mc.availableDropMoves ?? [],
      available_removal_squares: mc.availableRemovalSquares ?? [],
      is_additional_move: mc.isAdditionalMove ?? false,
    })),
    piece_removals: gs.pieceRemovals.map((pr) => ({
      move_index: pr.moveIndex,
      piece_type: pr.pieceType,
      piece_color: pr.pieceColor,
    })),
    time_reductions: gs.timeReductions.map((tr) => ({
      move_index: tr.moveIndex,
      seconds: tr.seconds,
    })),
    in_extra_turn: gs.inExtraTurn,
    crazyhouse: crazyhouseStateToProto(gs.crazyhouse),
    chess960: chess960StateToProto(gs.chess960),
  };
}

// ── GameSetupConfig conversion ───────────────────────────────────────

export function protoToGameSetupConfig(pm: ProtoMsg): GameSetupConfig {
  return {
    mode: protoToGameMode(pm.mode),
    botSide: protoToColor(pm.bot_side),
    botDifficulty: protoToBotLevel(pm.bot_difficulty),
    botDifficultyWhite: protoToBotLevel(pm.bot_difficulty_white),
    botDifficultyBlack: protoToBotLevel(pm.bot_difficulty_black),
    variantMode: protoToVariantMode(pm.variant_mode),
    gameType: protoToGameType(pm.game_type),
    engineId: protoToEngineId(pm.engine_id),
    engineIdWhite: protoToEngineId(pm.engine_id_white),
    engineIdBlack: protoToEngineId(pm.engine_id_black),
    enableKingOfTheHill: pm.enable_king_of_the_hill ?? false,
    enableClock: pm.enable_clock ?? false,
    initialTimeMs: pm.initial_time_ms ?? 300000,
    incrementMs: pm.increment_ms ?? 0,
    decrementMs: pm.decrement_ms ?? 0,
    enableDoubleCheckPressure: pm.enable_double_check_pressure ?? false,
    enableCrazyhouse: pm.enable_crazyhouse ?? false,
    enableChess960: pm.enable_chess960 ?? false,
    enableAtomic: pm.enable_atomic ?? false,
    invalidReportLossThreshold: pm.invalid_report_loss_threshold ?? 2,
    enableGspritzt: pm.enable_gspritzt ?? false,
    gspritztInvalidReportLossThreshold: pm.gspritzt_invalid_report_loss_threshold ?? 2,
    enableAdditionalMovePenalty: pm.enable_additional_move_penalty ?? false,
    additionalMoveCount: pm.additional_move_count ?? 1,
    enablePieceRemovalPenalty: pm.enable_piece_removal_penalty ?? false,
    pieceRemovalCount: pm.piece_removal_count ?? 1,
    enableTimeReductionPenalty: pm.enable_time_reduction_penalty ?? false,
    timeReductionSeconds: pm.time_reduction_seconds ?? 60,
    kingHuntPlyLimit: pm.king_hunt_ply_limit ?? 80,
    kingHuntGivenCheckTarget: pm.king_hunt_given_check_target ?? 5,
    initialFen: pm.initial_fen || undefined,
  };
}

export function gameSetupConfigToProto(cfg: GameSetupConfig): ProtoMsg {
  return {
    mode: TS_GAME_MODE_TO_PROTO[cfg.mode],
    bot_side: TS_COLOR_TO_PROTO[cfg.botSide],
    bot_difficulty: TS_BOT_LEVEL_TO_PROTO[cfg.botDifficulty],
    bot_difficulty_white: TS_BOT_LEVEL_TO_PROTO[cfg.botDifficultyWhite],
    bot_difficulty_black: TS_BOT_LEVEL_TO_PROTO[cfg.botDifficultyBlack],
    variant_mode: TS_VARIANT_TO_PROTO[cfg.variantMode],
    game_type: TS_GAME_TYPE_TO_PROTO[cfg.gameType],
    engine_id: TS_ENGINE_TO_PROTO[cfg.engineId],
    engine_id_white: TS_ENGINE_TO_PROTO[cfg.engineIdWhite],
    engine_id_black: TS_ENGINE_TO_PROTO[cfg.engineIdBlack],
    enable_king_of_the_hill: cfg.enableKingOfTheHill,
    enable_clock: cfg.enableClock,
    initial_time_ms: cfg.initialTimeMs,
    increment_ms: cfg.incrementMs,
    decrement_ms: cfg.decrementMs,
    enable_double_check_pressure: cfg.enableDoubleCheckPressure,
    enable_crazyhouse: cfg.enableCrazyhouse,
    enable_chess960: cfg.enableChess960,
    enable_atomic: cfg.enableAtomic,
    invalid_report_loss_threshold: cfg.invalidReportLossThreshold,
    enable_gspritzt: cfg.enableGspritzt,
    gspritzt_invalid_report_loss_threshold: cfg.gspritztInvalidReportLossThreshold,
    enable_additional_move_penalty: cfg.enableAdditionalMovePenalty,
    additional_move_count: cfg.additionalMoveCount,
    enable_piece_removal_penalty: cfg.enablePieceRemovalPenalty,
    piece_removal_count: cfg.pieceRemovalCount,
    enable_time_reduction_penalty: cfg.enableTimeReductionPenalty,
    time_reduction_seconds: cfg.timeReductionSeconds,
    king_hunt_ply_limit: cfg.kingHuntPlyLimit,
    king_hunt_given_check_target: cfg.kingHuntGivenCheckTarget,
    initial_fen: cfg.initialFen ?? '',
  };
}
