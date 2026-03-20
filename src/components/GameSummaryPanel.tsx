import type { GameSetupConfig } from '../core/blunziger/types';
import { getGameModeDefinition } from '../core/blunziger/types';
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

export function GameSummaryPanel({ config }: GameSummaryPanelProps) {
  const variantDef = getGameModeDefinition(config.variantModeId);
  const showClock = variantDef.config.enableClock || config.enableClock;
  const showMoveLimit = variantDef.config.moveLimit > 0;
  const showTimePenalty = variantDef.config.missedCheckPenalty !== 'loss' && showClock;

  return (
    <div className="game-summary">
      <h3>Game Settings</h3>
      <dl className="summary-list">
        <div className="summary-item">
          <dt>Variant</dt>
          <dd>{variantDef.name}</dd>
        </div>
        <div className="summary-item">
          <dt>Mode</dt>
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
        <div className="summary-item">
          <dt>Invalid Report Threshold</dt>
          <dd>{config.invalidReportLossThreshold}</dd>
        </div>
        {showClock && (
          <div className="summary-item">
            <dt>Time Control</dt>
            <dd>{Math.round(config.initialTimeMs / 60000)}+{Math.round(config.incrementMs / 1000)}</dd>
          </div>
        )}
        {config.enableClock && !variantDef.config.enableClock && (
          <div className="summary-item">
            <dt>Blitz Overlay</dt>
            <dd>Enabled</dd>
          </div>
        )}
        {variantDef.config.missedCheckPenalty !== 'loss' && (
          <div className="summary-item">
            <dt>Missed Check Penalty</dt>
            <dd>
              {variantDef.config.missedCheckPenalty === 'extra_move' ? 'Extra Move' : 'Piece Removal'}
              {showTimePenalty && ` + ${config.missedCheckTimePenaltySeconds}s`}
            </dd>
          </div>
        )}
        {showMoveLimit && (
          <div className="summary-item">
            <dt>Move Limit</dt>
            <dd>{config.moveLimit}</dd>
          </div>
        )}
        <div className="summary-item">
          <dt>King of the Hill</dt>
          <dd>{config.enableKingOfTheHill ? 'On' : 'Off'}</dd>
        </div>
      </dl>
    </div>
  );
}
