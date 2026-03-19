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
        </div>
      )}
    </div>
  );
}
