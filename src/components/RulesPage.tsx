import { VARIANT_MODE_DEFINITIONS } from '../core/blunzinger/types';
import './RulesPage.css';

export function RulesPage() {
  return (
    <div className="rules-page">
      <div className="rules-page-card">
        <h2>📖 Rules</h2>
        <p className="rules-page-intro">
          Blunzinger Chess adds forced-check rules on top of standard chess.
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

          <div className="rules-mode-block">
            <h4>Chess960</h4>
            <p>When enabled, the starting position is randomized according to Chess960 (Fischer Random Chess) rules.</p>
            <ul>
              <li>Bishops start on opposite-colored squares</li>
              <li>The king starts between the two rooks</li>
              <li>White and Black have mirrored back ranks</li>
              <li>Castling ends on standard target squares (king on g/c-file, rook on f/d-file)</li>
              <li>Combinable with all variant modes and game types</li>
            </ul>
          </div>

          <div className="rules-mode-block">
            <h4>Crazyhouse</h4>
            <p>Captured pieces go into the capturing player's reserve and can be dropped back on the board instead of making a normal move.</p>
            <ul>
              <li>Captured pieces change color and join the captor's reserve</li>
              <li>A player may drop a reserve piece onto any empty square instead of moving</li>
              <li>Pawns cannot be dropped on the 1st or 8th rank</li>
              <li>A drop must not leave the dropping player's king in check</li>
              <li>Drop moves are included in checking/non-checking move detection for variant rules</li>
            </ul>
          </div>

          <div className="rules-mode-block">
            <h4>Atomic Chess</h4>
            <p>Every capture triggers an explosion on the destination square, destroying the capturing piece, the captured piece, and all non-pawn pieces on adjacent squares.</p>
            <ul>
              <li>Kings may never capture (the capturing king would be destroyed)</li>
              <li>A move is illegal if the explosion would destroy the moving side's own king</li>
              <li>Exploding the opponent's king wins immediately</li>
              <li>Kings may stand adjacent since kings cannot capture</li>
              <li>Pawns are immune to adjacency explosions but are destroyed when directly captured</li>
            </ul>
          </div>

          <div className="rules-mode-block">
            <h4>Blunzinger G&apos;spritzt</h4>
            <p>A meta-reporting layer available only in Report Incorrectness mode.</p>
            <ul>
              <li>If a player violates the forced-move requirement and the opponent <strong>fails to report it</strong> (makes a move instead), the violating player may press <strong>&ldquo;Report Blunzinger G&apos;spritzt&rdquo;</strong> to punish the opponent for missing the report opportunity.</li>
              <li><strong>Valid G&apos;spritzt report:</strong> The opponent (who missed reporting) loses immediately.</li>
              <li><strong>Invalid G&apos;spritzt report:</strong> The reporter&apos;s G&apos;spritzt invalid report counter increases. After reaching the configured threshold (default: 2), the reporter loses.</li>
              <li>G&apos;spritzt has its own separate invalid-report counter and threshold.</li>
              <li>The G&apos;spritzt report window is available for exactly one move after the opponent fails to report.</li>
            </ul>
          </div>
        </section>

        {/* Bot Engines & Difficulty */}
        <section className="rules-section">
          <h3>Bot Engines &amp; Difficulty</h3>

          <p className="rules-mode-desc" style={{ marginBottom: 12 }}>
            Bot behaviour depends on the selected engine. Each engine implements difficulty
            levels differently.
          </p>

          <div className="rules-mode-block">
            <h4>Blunznforön (default)</h4>
            <p className="rules-mode-desc">
              Custom tactical bot with negamax search, alpha-beta pruning, quiescence search,
              and variant-aware move ordering.
            </p>
            <table className="rules-difficulty-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Search Depth</th>
                  <th>Quiescence</th>
                  <th>Randomisation</th>
                  <th>Violation Prob.</th>
                  <th>Tactical Ext.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Easy</strong></td>
                  <td>1</td>
                  <td>0</td>
                  <td>High (200 cp)</td>
                  <td>25%</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td><strong>Medium</strong></td>
                  <td>2</td>
                  <td>1</td>
                  <td>Low (50 cp)</td>
                  <td>0%</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td><strong>Hard</strong></td>
                  <td>3</td>
                  <td>2</td>
                  <td>Minimal (10 cp)</td>
                  <td>0%</td>
                  <td>Yes</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rules-mode-block">
            <h4>Blunznfish</h4>
            <p className="rules-mode-desc">
              Powered by custom Fairy-Stockfish (ffish.js) WASM with native mustCheck support.
              Uses variant-aware legal move generation with heuristic scoring.
            </p>
            <ul>
              <li>All difficulty levels use 1-ply variant-aware move generation.</li>
              <li>Strength comes from native variant rule enforcement rather than deeper search.</li>
              <li>Falls back to heuristic analysis when WASM is unavailable.</li>
            </ul>
          </div>

          <div className="rules-mode-block">
            <h4>Heuristic</h4>
            <p className="rules-mode-desc">
              Lightweight built-in evaluator using material balance and mobility.
              All difficulty levels use the same 1-ply evaluation.
            </p>
          </div>

          <div className="rules-mode-block">
            <h4>Violation Reporting</h4>
            <p className="rules-mode-desc">
              Shared across all engines:
            </p>
            <ul>
              <li><strong>Hard / Medium:</strong> Always report valid violations.</li>
              <li><strong>Easy:</strong> Always reports <em>gave forbidden check</em>; probabilistically reports <em>missed check</em> (base 15%, +25% per available checking move, capped at 90%).</li>
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
