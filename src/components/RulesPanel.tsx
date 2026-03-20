import { useState } from 'react';
import type { VariantModeId } from '../core/blunziger/types';
import { getGameModeDefinition } from '../core/blunziger/types';
import './RulesPanel.css';

interface RulesPanelProps {
  variantModeId: VariantModeId;
}

export function RulesPanel({ variantModeId }: RulesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const def = getGameModeDefinition(variantModeId);

  return (
    <div className="rules-panel">
      <button className="rules-toggle" onClick={() => setExpanded(!expanded)}>
        📖 {expanded ? 'Hide Rules' : 'Show Rules'}
      </button>

      {expanded && (
        <div className="rules-content">
          <h3>{def.name}</h3>
          <p>{def.description}</p>

          {variantModeId === 'classic_blunziger' && <ClassicRules />}
          {variantModeId === 'double_check_pressure' && <DoubleCheckPressureRules />}
          {variantModeId === 'blitz_blunziger' && <BlitzRules />}
          {variantModeId === 'penalty_instead_of_loss' && <PenaltyRules />}
          {variantModeId === 'king_hunter' && <KingHunterRules />}
          {variantModeId === 'reverse_blunziger' && <ReverseRules />}

          <h4>King of the Hill (Optional)</h4>
          <p>
            When enabled, a player wins immediately if their king reaches one of the
            four center squares: <strong>d4, e4, d5, or e5</strong>.
          </p>
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
        <strong> expected</strong> to play a checking move. If they don't, the opponent
        can press <strong>"Report Missed Check"</strong> before making their own move.
      </p>
      <ul>
        <li><strong>Valid report:</strong> The violating player loses.</li>
        <li><strong>Invalid report:</strong> Reporter's invalid report counter increases.
          After reaching the threshold, the reporter loses.</li>
      </ul>
    </>
  );
}

function DoubleCheckPressureRules() {
  return (
    <>
      <h4>Double Check Pressure</h4>
      <p>
        Normal Blunziger forced-check rules apply, but with an additional twist:
        if <strong>two or more</strong> checking moves exist and the player misses them,
        they <strong>lose immediately</strong> (no report needed).
      </p>
      <p>
        If exactly one checking move exists and is missed, normal report-based handling applies.
      </p>
    </>
  );
}

function BlitzRules() {
  return (
    <>
      <h4>Blitz Blunziger</h4>
      <p>
        Standard Blunziger rules with chess clocks. Each side has a countdown timer.
        If your time reaches zero, you lose.
      </p>
    </>
  );
}

function PenaltyRules() {
  return (
    <>
      <h4>Penalty Instead of Loss</h4>
      <p>
        Missing a forced check does <strong>not</strong> cause an immediate loss.
        Instead, the opponent receives <strong>one extra consecutive move</strong> as penalty.
      </p>
      <p>
        After the violating player's move, the opponent makes their normal move, then
        immediately gets a second consecutive move. Turn order then resumes normally.
      </p>
      <p>The "Report Missed Check" button is <strong>disabled</strong> in this mode.</p>
      <h4>Clock Penalty (Blitz)</h4>
      <p>
        When combined with chess clocks, a missed forced check also <strong>subtracts a
        configurable number of seconds</strong> from the violating player's remaining time.
        If the clock reaches 0 from this penalty, that player loses immediately on time.
      </p>
    </>
  );
}

function KingHunterRules() {
  return (
    <>
      <h4>King Hunter Mode</h4>
      <p>
        Each time a player gives check, they score <strong>1 point</strong>.
        The game ends after a configured move limit. The player with more points wins.
        If tied, it's a draw.
      </p>
      <p>
        If checkmate occurs before the move limit, the game ends immediately as normal.
      </p>
    </>
  );
}

function ReverseRules() {
  return (
    <>
      <h4>Reverse Blunziger</h4>
      <p>
        If a checking move exists, the player is <strong>forbidden</strong> from giving check.
        They must play a non-checking legal move instead. Violation = immediate loss.
      </p>
      <p>
        <strong>Exception:</strong> If ALL legal moves give check, the player may play any legal move.
      </p>
    </>
  );
}
