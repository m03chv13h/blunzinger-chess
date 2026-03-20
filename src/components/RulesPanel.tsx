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
          {variantModeId === 'king_hunter' && <KingHunterRules />}
          {variantModeId === 'reverse_blunziger' && <ReverseRules />}

          <PenaltyRules />
          <ClockRules />

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

function PenaltyRules() {
  return (
    <>
      <h4>Composable Penalties</h4>
      <p>
        Penalties on missed forced check can be enabled via checkboxes in setup.
        When any penalty is enabled, the "Report Missed Check" button is <strong>disabled</strong>.
        When no penalty is enabled, report-based handling is used (classic behavior).
      </p>
      <p>
        Enabled penalties are applied in deterministic order:
      </p>
      <ol>
        <li><strong>Additional move:</strong> The opponent receives one extra consecutive move.</li>
        <li><strong>Piece removal:</strong> One of the violating player's pieces is removed — the opponent chooses which one. Kings can never be removed. If no removable piece exists, the violator loses immediately.</li>
        <li><strong>Time reduction:</strong> A configurable number of seconds (default: 5) is subtracted from the violating player's remaining clock. If the clock reaches 0, that player loses immediately. Only applies when the clock is enabled.</li>
      </ol>
      <p>
        If a move results in immediate checkmate, King of the Hill win, or any other
        terminal condition, penalties are <strong>not</strong> applied.
      </p>
    </>
  );
}

function ClockRules() {
  return (
    <>
      <h4>Clock (Optional)</h4>
      <p>
        When enabled, each side starts with the same initial time (default: 5 minutes).
        If your time reaches zero, you lose. Clocks pause when the game ends.
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

