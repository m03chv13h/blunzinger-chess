export type { EvaluationResult } from './types';
export { evaluateGameState } from './evaluate';
export { evaluateBasePosition } from './evaluatePosition';
export {
  evaluateVariantAdjustments,
  evaluateClassicBlunzinger,
  evaluateReverseBlunzinger,
  evaluateKingHuntMoveLimit,
  evaluateKingHuntGivenCheckLimit,
  evaluateReportIncorrectness,
  evaluatePenaltyOnMiss,
  evaluateKingOfTheHill,
  evaluateClock,
  evaluateDoubleCheckPressure,
} from './evaluateVariant';
