import type { GameSetupConfig } from '../core/blunziger/types';
import { getVariantModeDefinition } from '../core/blunziger/types';
import { getEngineInfo } from '../core/engine/engineRegistry';
import { formatMsToTime } from '../utils/timeFormat';
import './SimulationDetailsTable.css';

interface SimulationDetailsTableProps {
  config: GameSetupConfig;
}

const LEVEL_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const GAME_TYPE_LABELS: Record<string, string> = {
  report_incorrectness: 'Report Incorrectness',
  penalty_on_miss: 'Penalty on Miss',
};

export function SimulationDetailsTable({ config }: SimulationDetailsTableProps) {
  const variantDef = getVariantModeDefinition(config.variantMode);
  const showClock = config.enableClock;
  const isPenalty = config.gameType === 'penalty_on_miss';
  const isReport = config.gameType === 'report_incorrectness';
  const isKingHuntMoveLimit = config.variantMode === 'classic_king_hunt_move_limit';
  const isKingHuntCheckLimit = config.variantMode === 'classic_king_hunt_given_check_limit';

  const penaltyLabels: string[] = [];
  if (isPenalty) {
    if (config.enableAdditionalMovePenalty) {
      penaltyLabels.push(`Additional move: ${config.additionalMoveCount}`);
    }
    if (config.enablePieceRemovalPenalty) {
      penaltyLabels.push(`Piece removal: ${config.pieceRemovalCount}`);
    }
    if (config.enableTimeReductionPenalty) {
      penaltyLabels.push(`Time reduction: ${config.timeReductionSeconds}s`);
    }
  }

  return (
    <div className="sim-details-table">
      <h4 className="sim-details-heading">Game Details</h4>
      <dl className="sim-details-list">
        <div className="sim-details-item">
          <dt>Variant Mode</dt>
          <dd>{variantDef.name}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Game Type</dt>
          <dd>{GAME_TYPE_LABELS[config.gameType]}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Bot Difficulty (White)</dt>
          <dd>{LEVEL_LABELS[config.botDifficultyWhite] ?? config.botDifficultyWhite}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Bot Difficulty (Black)</dt>
          <dd>{LEVEL_LABELS[config.botDifficultyBlack] ?? config.botDifficultyBlack}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Engine (White)</dt>
          <dd>{getEngineInfo(config.engineIdWhite)?.name ?? config.engineIdWhite}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Engine (Black)</dt>
          <dd>{getEngineInfo(config.engineIdBlack)?.name ?? config.engineIdBlack}</dd>
        </div>
        {isReport && (
          <div className="sim-details-item">
            <dt>Invalid Report Threshold</dt>
            <dd>{config.invalidReportLossThreshold}</dd>
          </div>
        )}
        {isPenalty && penaltyLabels.length > 0 && (
          <div className="sim-details-item">
            <dt>Penalties</dt>
            <dd>{penaltyLabels.join(', ')}</dd>
          </div>
        )}
        {isKingHuntMoveLimit && (
          <div className="sim-details-item">
            <dt>Ply Limit</dt>
            <dd>{config.kingHuntPlyLimit}</dd>
          </div>
        )}
        {isKingHuntCheckLimit && (
          <div className="sim-details-item">
            <dt>Given Check Target</dt>
            <dd>{config.kingHuntGivenCheckTarget}</dd>
          </div>
        )}
        <div className="sim-details-item">
          <dt>King of the Hill</dt>
          <dd>{config.enableKingOfTheHill ? 'On' : 'Off'}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Clock</dt>
          <dd>{showClock ? formatMsToTime(config.initialTimeMs) : 'Off'}</dd>
        </div>
        {showClock && config.incrementMs > 0 && (
          <div className="sim-details-item">
            <dt>Increment</dt>
            <dd>{formatMsToTime(config.incrementMs)}</dd>
          </div>
        )}
        {showClock && config.decrementMs > 0 && (
          <div className="sim-details-item">
            <dt>Decrement</dt>
            <dd>{formatMsToTime(config.decrementMs)}</dd>
          </div>
        )}
        <div className="sim-details-item">
          <dt>Double Check Pressure</dt>
          <dd>{config.enableDoubleCheckPressure ? 'On' : 'Off'}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Crazyhouse</dt>
          <dd>{config.enableCrazyhouse ? 'On' : 'Off'}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Chess960</dt>
          <dd>{config.enableChess960 ? 'On' : 'Off'}</dd>
        </div>
        <div className="sim-details-item">
          <dt>Atomic Chess</dt>
          <dd>{config.enableAtomic ? 'On' : 'Off'}</dd>
        </div>
      </dl>
    </div>
  );
}
