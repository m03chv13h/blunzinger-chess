import { VARIANT_MODE_DEFINITIONS } from '../core/blunziger/types';
import './RulesPage.css';

export function RulesPage() {
  return (
    <div className="rules-page">
      <div className="rules-page-card">
        <h2>📖 Rules</h2>
        <p className="rules-page-intro">
          Blunziger Chess adds forced-check rules on top of standard chess.
          Below are all variant modes, game types, and overlays explained.
        </p>

        {/* Variant Modes */}
        <section className="rules-section">
          <h3>Variant Modes</h3>

          {VARIANT_MODE_DEFINITIONS.map((def) => (
            <div key={def.id} className="rules-mode-block">
              <h4>{def.name}</h4>
              <p className="rules-mode-desc">{def.description}</p>
              {def.id === 'classic_blunzinger' && (
                <ul>
                  <li>If a player has <strong>any legal move that gives check</strong>, they are <strong>required</strong> to play a checking move.</li>
                  <li>Failing to do so is a <em>violation</em>.</li>
                </ul>
              )}
              {def.id === 'reverse_blunzinger' && (
                <ul>
                  <li>If a checking move exists but <strong>non-checking alternatives</strong> are also available, the player must play a non-checking move.</li>
                  <li>Giving check when it can be avoided is a <em>violation</em>.</li>
                  <li><strong>Exception:</strong> If all legal moves give check, any move is allowed.</li>
                </ul>
              )}
              {def.id === 'classic_king_hunt_move_limit' && (
                <ul>
                  <li>Uses Classic Blunzinger forced-check rules.</li>
                  <li>Each check scores <strong>1 point</strong>.</li>
                  <li>Game ends at the configured <strong>ply limit</strong>; higher score wins.</li>
                  <li>Checkmate before the limit ends the game immediately.</li>
                </ul>
              )}
              {def.id === 'classic_king_hunt_given_check_limit' && (
                <ul>
                  <li>Uses Classic Blunzinger forced-check rules.</li>
                  <li>Each check scores <strong>1 point</strong>.</li>
                  <li>First to reach the configured <strong>given check target</strong> wins.</li>
                  <li>Checkmate or other terminal conditions take precedence.</li>
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* Game Types */}
        <section className="rules-section">
          <h3>Game Types</h3>

          <div className="rules-mode-block">
            <h4>Report Incorrectness</h4>
            <p className="rules-mode-desc">
              When a violation occurs, the game continues. The opponent may press "Report Violation" before their next move.
            </p>
            <ul>
              <li><strong>Valid report:</strong> The violating player loses immediately.</li>
              <li><strong>Invalid report:</strong> Reporter's invalid counter increases. After reaching the threshold, the reporter loses.</li>
            </ul>
          </div>

          <div className="rules-mode-block">
            <h4>Penalty on Miss</h4>
            <p className="rules-mode-desc">
              Penalties are applied automatically when a violation occurs, instead of using report-based resolution.
            </p>
            <ol>
              <li><strong>Additional move:</strong> The opponent receives extra consecutive move(s).</li>
              <li><strong>Piece removal:</strong> The opponent chooses piece(s) of the violating player to remove. Kings can never be removed.</li>
              <li><strong>Time reduction:</strong> Seconds are subtracted from the violating player's clock. Only applies when the clock is enabled.</li>
            </ol>
            <p>If the move results in checkmate or another terminal condition, no penalties are applied.</p>
          </div>
        </section>

        {/* Overlays */}
        <section className="rules-section">
          <h3>Overlays / Options</h3>

          <div className="rules-mode-block">
            <h4>King of the Hill</h4>
            <p>A player wins immediately if their king reaches one of the four center squares: <strong>d4, e4, d5, or e5</strong>.</p>
          </div>

          <div className="rules-mode-block">
            <h4>Clock</h4>
            <p>Each side starts with the same initial time. If your time reaches zero, you lose. Optional increment and decrement per move.</p>
          </div>

          <div className="rules-mode-block">
            <h4>Double Check Pressure</h4>
            <p>When enabled, if 2 or more required moves exist and the player misses the requirement, the miss is treated as <em>severe</em>.</p>
            <ul>
              <li><strong>Report mode:</strong> A severe miss results in immediate loss (no report needed).</li>
              <li><strong>Penalty mode:</strong> Penalties are applied normally.</li>
            </ul>
          </div>
        </section>

        {/* Player Modes */}
        <section className="rules-section">
          <h3>Player Modes</h3>

          <div className="rules-mode-block">
            <h4>Human vs Human</h4>
            <p>Two players take turns on the same device. Both sides are controlled by humans.</p>
          </div>

          <div className="rules-mode-block">
            <h4>Human vs Bot</h4>
            <p>Play against a computer opponent. Choose your color and the bot difficulty level.</p>
          </div>

          <div className="rules-mode-block">
            <h4>Bot vs Bot</h4>
            <p>Watch two bots play against each other. You can pause, adjust move delay, and observe the game unfold automatically.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
