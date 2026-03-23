import type { GameSetupConfig } from '../core/blunziger/types';
import { getVariantModeDefinition } from '../core/blunziger/types';
import { getEngineInfo } from '../core/engine/engineRegistry';
import { formatMsToTime } from '../utils/timeFormat';
import './GameSummaryPanel.css';

interface GameSummaryPanelProps {
  config: GameSetupConfig;
}

const MODE_LABELS: Record<string, string> = {
  hvh: 'Human vs Human',
  hvbot: 'Human vs Bot',
  botvbot: 'Bot vs Bot',
};

const LEVEL_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const GAME_TYPE_LABELS: Record<string, string> = {
  report_incorrectness: 'Report Incorrectness',
  penalty_on_miss: 'Penalty on Miss',
};

export function GameSummaryPanel({ config }: GameSummaryPanelProps) {
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
    <div className="game-summary">
      <h3>Game Settings</h3>
      <dl className="summary-list">
        <div className="summary-item">
          <dt>Variant Mode</dt>
          <dd>{variantDef.name}</dd>
        </div>
        <div className="summary-item">
          <dt>Game Type</dt>
          <dd>{GAME_TYPE_LABELS[config.gameType]}</dd>
        </div>
        <div className="summary-item">
          <dt>Player Mode</dt>
          <dd>{MODE_LABELS[config.mode]}</dd>
        </div>
        {(config.mode === 'hvbot' || config.mode === 'botvbot') && (
          <div className="summary-item">
            <dt>Bot Difficulty</dt>
            <dd>{LEVEL_LABELS[config.botDifficulty]}</dd>
          </div>
        )}
        {config.mode === 'hvbot' && (
          <div className="summary-item">
            <dt>Playing As</dt>
            <dd>{config.botSide === 'b' ? 'White' : 'Black'}</dd>
          </div>
        )}
        {config.mode === 'hvbot' && (
          <div className="summary-item">
            <dt>Engine</dt>
            <dd>{getEngineInfo(config.engineId)?.name ?? config.engineId}</dd>
          </div>
        )}
        {config.mode === 'botvbot' && (
          <>
            <div className="summary-item">
              <dt>Engine (White)</dt>
              <dd>{getEngineInfo(config.engineIdWhite)?.name ?? config.engineIdWhite}</dd>
            </div>
            <div className="summary-item">
              <dt>Engine (Black)</dt>
              <dd>{getEngineInfo(config.engineIdBlack)?.name ?? config.engineIdBlack}</dd>
            </div>
          </>
        )}
        {isReport && (
          <div className="summary-item">
            <dt>Invalid Report Threshold</dt>
            <dd>{config.invalidReportLossThreshold}</dd>
          </div>
        )}
        {isPenalty && penaltyLabels.length > 0 && (
          <div className="summary-item">
            <dt>Penalties</dt>
            <dd>{penaltyLabels.join(', ')}</dd>
          </div>
        )}
        {isKingHuntMoveLimit && (
          <div className="summary-item">
            <dt>Ply Limit</dt>
            <dd>{config.kingHuntPlyLimit}</dd>
          </div>
        )}
        {isKingHuntCheckLimit && (
          <div className="summary-item">
            <dt>Given Check Target</dt>
            <dd>{config.kingHuntGivenCheckTarget}</dd>
          </div>
        )}
        <div className="summary-item">
          <dt>King of the Hill</dt>
          <dd>{config.enableKingOfTheHill ? 'On' : 'Off'}</dd>
        </div>
        {showClock && (
          <div className="summary-item">
            <dt>Clock</dt>
            <dd>{formatMsToTime(config.initialTimeMs)}</dd>
          </div>
        )}
        <div className="summary-item">
          <dt>Double Check Pressure</dt>
          <dd>{config.enableDoubleCheckPressure ? 'On' : 'Off'}</dd>
        </div>
      </dl>
    </div>
  );
}
