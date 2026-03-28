import { useState } from 'react';
import type { VariantMode, GameType } from '../core/blunziger/types';
import { getVariantModeDefinition } from '../core/blunziger/types';
import './RulesPanel.css';

interface RulesPanelProps {
  variantMode: VariantMode;
  gameType: GameType;
}

export function RulesPanel({ variantMode, gameType }: RulesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const def = getVariantModeDefinition(variantMode);

  return (
    <div className="rules-panel">
      <button className="rules-toggle" onClick={() => setExpanded(!expanded)}>
        📖 {expanded ? 'Hide Rules' : 'Show Rules'}
      </button>

      {expanded && (
        <div className="rules-content">
          <h3>{def.name}</h3>
          <p>{def.description}</p>

          {variantMode === 'classic_blunzinger' && <ClassicRules />}
          {variantMode === 'reverse_blunzinger' && <ReverseRules />}
          {variantMode === 'classic_king_hunt_move_limit' && <KingHuntMoveLimitRules />}
          {variantMode === 'classic_king_hunt_given_check_limit' && <KingHuntGivenCheckLimitRules />}

          {gameType === 'report_incorrectness' && <ReportRules variantMode={variantMode} />}
          {gameType === 'penalty_on_miss' && <PenaltyRules />}

          <OverlayRules />
        </div>
      )}
    </div>
  );
}

function ClassicRules() {
  return (
    <>
      <h4>Forced Check Rule</h4>
      <p>
        If a player has <strong>any legal move that gives check</strong>, they are
        <strong> required</strong> to play a checking move.
      </p>
    </>
  );
}

function ReverseRules() {
  return (
    <>
      <h4>Reverse Forced Check Rule</h4>
      <p>
        If a checking move exists but <strong>non-checking alternatives</strong> are also available,
        the player is <strong>required</strong> to play a non-checking move.
        Giving check when it can be avoided is a violation.
      </p>
      <p>
        <strong>Exception:</strong> If ALL legal moves give check, any move is allowed.
      </p>
    </>
  );
}

function KingHuntMoveLimitRules() {
  return (
    <>
      <h4>King Hunt — Move Limit</h4>
      <p>
        Uses Classic Blunzinger forced-check rules. Each time a player gives check, they score <strong>1 point</strong>.
        The game ends when the configured <strong>ply limit</strong> is reached. The player with more points wins; tied = draw.
      </p>
      <p>If checkmate occurs before the ply limit, the game ends immediately as normal.</p>
    </>
  );
}

function KingHuntGivenCheckLimitRules() {
  return (
    <>
      <h4>King Hunt — Given Check Limit</h4>
      <p>
        Uses Classic Blunzinger forced-check rules. Each time a player gives check, they score <strong>1 point</strong>.
        The first player to reach the configured <strong>given check target</strong> wins immediately.
      </p>
      <p>If checkmate or another terminal condition occurs first, that result takes precedence.</p>
    </>
  );
}

function ReportRules({ variantMode }: { variantMode: VariantMode }) {
  const isReverse = variantMode === 'reverse_blunzinger';
  return (
    <>
      <h4>Game Type: Report Incorrectness</h4>
      <p>
        When a player violates the forced-move requirement, the game continues.
        The opponent may press <strong>"Report Violation"</strong> before making their next move.
      </p>
      <ul>
        <li><strong>Valid report:</strong> The violating player loses immediately.</li>
        <li><strong>Invalid report:</strong> Reporter's invalid report counter increases.
          After reaching the configured threshold, the reporter loses.</li>
      </ul>
      {isReverse ? (
        <p><em>In Reverse Blunzinger, a valid report means the opponent gave check when non-checking moves were available.</em></p>
      ) : (
        <p><em>A valid report means the opponent missed a forced checking move.</em></p>
      )}
    </>
  );
}

function PenaltyRules() {
  return (
    <>
      <h4>Game Type: Penalty on Miss</h4>
      <p>
        When a player violates the forced-move requirement, penalties are applied automatically
        instead of using report-based resolution.
      </p>
      <p>Enabled penalties are applied in deterministic order:</p>
      <ol>
        <li><strong>Additional move:</strong> The opponent receives extra consecutive move(s). Default: 1.</li>
        <li><strong>Piece removal:</strong> Piece(s) of the violating player are removed — the opponent chooses.
          Kings can never be removed. If no removable piece exists, the violator loses immediately. Default: 1.</li>
        <li><strong>Time reduction:</strong> Seconds subtracted from the violating player's clock.
          If the clock reaches 0, that player loses immediately. Only applies when the clock is enabled. Default: 60 seconds.</li>
      </ol>
      <p>
        If the move itself results in checkmate, King of the Hill win, or another terminal condition,
        <strong> no penalties are applied</strong>.
      </p>
    </>
  );
}

function OverlayRules() {
  return (
    <>
      <h4>Overlays / Options</h4>

      <p><strong>King of the Hill:</strong> When enabled, a player wins immediately if their king
        reaches one of the four center squares: <strong>d4, e4, d5, or e5</strong>.</p>

      <p><strong>Clock:</strong> When enabled, each side starts with the same initial time (default: 5 minutes).
        If your time reaches zero, you lose.</p>

      <p><strong>Double Check Pressure:</strong> When enabled, if 2 or more required moves exist
        and the player misses the requirement, the miss is treated as severe.
        Under Report Incorrectness, a severe miss results in immediate loss (no report needed).
        Under Penalty on Miss, penalties are applied normally.</p>

      <p><strong>Chess960:</strong> When enabled, the starting position is randomized according to
        Chess960 (Fischer Random Chess) rules. Bishops start on opposite-colored squares, and the
        king starts between the two rooks. Castling still ends on the standard target squares
        (king on g-file/c-file, rook on f-file/d-file). Chess960 can be combined with all variant
        modes and game types.</p>
    </>
  );
}
