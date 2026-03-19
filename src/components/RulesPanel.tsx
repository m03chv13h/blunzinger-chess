import { useState } from 'react';
import './RulesPanel.css';

export function RulesPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rules-panel">
      <button className="rules-toggle" onClick={() => setExpanded(!expanded)}>
        📖 {expanded ? 'Hide Rules' : 'Show Rules'}
      </button>

      {expanded && (
        <div className="rules-content">
          <h3>Blunziger Chess Rules</h3>

          <p>
            Blunziger Chess is standard chess with one additional rule:
          </p>

          <h4>Forced Check Rule</h4>
          <p>
            If a player has <strong>any legal move that gives check</strong>, they are
            <strong> expected</strong> to play a checking move. However, the system does NOT
            force the move — players can still play any legal move.
          </p>

          <h4>Reporting System</h4>
          <p>
            If a player makes a non-checking move when a checking move was available (a
            "missed forced-check violation"), the <strong>opponent</strong> can press the
            <strong> "Report Missed Check"</strong> button <em>before making their own move</em>.
          </p>

          <ul>
            <li>
              <strong>Valid report:</strong> The violating player loses immediately.
            </li>
            <li>
              <strong>Invalid report:</strong> The reporter's invalid report counter increases.
              After reaching the configured threshold (default: 2), the reporter loses.
            </li>
          </ul>

          <h4>Key Details</h4>
          <ul>
            <li>Moves are never auto-forced — all legal moves are always available</li>
            <li>Violations are detected after the move is played</li>
            <li>Reports must be made before the reporter plays their next move</li>
            <li>Bots always obey the forced-check rule</li>
          </ul>

          <h4>King of the Hill (Optional)</h4>
          <p>
            When enabled via the checkbox in game settings, <strong>King of the Hill</strong> adds
            an additional win condition: a player wins immediately if their king reaches one of the
            four center squares: <strong>d4, e4, d5, or e5</strong>.
          </p>
          <p>
            This mode works <em>together</em> with the Blunziger forced-check rules — it does not
            replace them. Both rule sets apply simultaneously.
          </p>
          <h4>Rule Precedence</h4>
          <ul>
            <li>If a player's move reaches the hill, they win immediately — even if they
            missed a forced check on that same move.</li>
            <li>The game ends as soon as the hill is reached; no report can overturn the result.</li>
            <li>If the hill is not reached, normal Blunziger rules (forced-check detection
            and reporting) continue to apply.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
