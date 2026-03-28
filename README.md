# Blunziger Chess ♟

A browser-based chess variant with a **normalized variant architecture** built on top of standard chess.

## What is Blunziger Chess?

Blunziger Chess is standard chess with additional variant rules organized into three clean, composable layers:

1. **Variant Mode** — defines the core rule objective
2. **Game Type** — defines what happens when the player misses the required move behavior
3. **Overlays / Options** — additional features layered on top

Once a game starts, the configuration is **locked for the duration of the match**.

## A) Variant Modes (4)

| Variant Mode | Rule |
|-------------|------|
| **Classic Blunzinger** | If a checking move exists, the player is required to play a checking move. |
| **Reverse Blunzinger** | If non-checking moves exist, the player is required to play a non-checking move. If all legal moves give check, any move is allowed. |
| **Classic Blunzinger – King Hunt – Move Limit** | Classic Blunzinger forced-check rules with King Hunt scoring. Game ends at a configured ply limit. Player with more check-points wins; tied = draw. |
| **Classic Blunzinger – King Hunt – Given Check Limit** | Classic Blunzinger forced-check rules with King Hunt scoring. First player to reach the configured given-check target wins immediately. |

### King Hunt Scoring

Each time a player makes a move that gives check, they score **1 point** (1 check count).

- **Move Limit variant**: uses a configurable **ply limit** (total half-moves). At the limit, the player with the higher score wins; tied = draw. Default: 80 ply.
- **Given Check Limit variant**: uses a configurable **target check count**. When a player reaches the target, they win immediately. Default: 5 checks.

If a normal terminal condition (checkmate, King of the Hill, timeout) occurs before the limit, that result takes precedence.

## B) Game Types (2)

Every variant mode supports exactly these two game types:

### Report Incorrectness

- The game continues after a miss
- The opponent may report the miss by pressing **"Report Violation"**
- If the report is correct, the violating player loses immediately
- If the report is incorrect, the reporter's invalid-report counter increments; reaching the configured threshold (default: 2) → reporter loses

**Terminology:**
- Classic / King Hunt: "report missed checking move"
- Reverse Blunzinger: "report that the player gave check when non-checking moves were available"

### Penalty on Miss

- A miss does not use report-based resolution
- Instead, configured penalties are applied automatically in deterministic order:
  1. **Additional move** (default: 1 extra consecutive move)
  2. **Piece removal** (default: 1 piece removed)
  3. **Time reduction** (default: 60 seconds; only applies when Clock is enabled)

Penalties are composable — multiple can be combined.

If a move produces an immediate terminal result (checkmate, King of the Hill, etc.), **no penalties are applied**.

### Penalty Details

**Additional Move:**
- The non-violating side gets N extra consecutive moves (where N = configured additional move count)
- Default: 1

**Piece Removal:**
- The violating player loses N piece(s) (where N = configured piece removal count)
- The non-violating side chooses which piece(s) to remove
- Kings can never be removed
- If no removable pieces exist, the violator loses immediately
- Bot chooser: prefers highest-value piece (queen > rook > bishop/knight > pawn), deterministic tie-breaking

**Time Reduction:**
- Reduces the violating player's clock by the configured number of seconds
- Clamped at 0; if it reaches 0, the violator loses immediately
- Only relevant when Clock overlay is enabled
- Default: 60 seconds

## C) Overlays / Options (5)

All variant modes and both game types can be extended with:

### King of the Hill (Optional)

When enabled, a player wins immediately if their king reaches one of the four center squares: **d4, e4, d5, or e5**.

### Clock (Optional)

- One shared initial-time input (default: **5 minutes**) applies equally to both sides
- No separate per-side time inputs
- Time reaching zero → loss by timeout
- Clocks pause when the game ends

### Double Check Pressure (Optional)

When enabled, if **2 or more** required moves exist for the current side (under the current variant mode) and the player misses the requirement, the miss is treated as **severe**:

- **Report Incorrectness**: severe miss → immediate loss (no report needed)
- **Penalty on Miss**: penalties applied as normal

### Crazyhouse (Optional)

When enabled, captured pieces go into the capturing player's **reserve** and can be placed back on the board instead of making a normal move.

**Rules:**
- When a piece is captured, it is added to the capturing player's reserve (changing color)
- Instead of a normal move, a player may **drop** a piece from their reserve onto any empty square
- Pawns cannot be dropped on the 1st or 8th rank
- A drop must not leave the dropping player's king in check
- Dropped pieces behave like normal pieces and can be captured and re-added to reserve

**Reserves:**
Each player has a reserve that tracks: pawns, knights, bishops, rooks, and queens.

**Interaction with Blunziger rules:**
- Drop moves are included in checking/non-checking move detection
- In Classic mode: if a checking drop exists, the player must give check (via drop or regular move)
- In Reverse mode: if non-checking drops exist, the player must avoid giving check
- Drop violations are reportable (Report mode) or auto-penalized (Penalty mode)

**Evaluation:**
Reserve material is included in the evaluation. Values: pawn=100, knight=300, bishop=300, rook=500, queen=900 centipawns.

**Bot support:**
Bots consider drop moves alongside regular moves, respecting variant rules.

### Chess960 (Optional)

When enabled, the starting position is randomized according to Chess960 (Fischer Random Chess) rules. Chess960 can be combined with all variant modes, both game types, and all other overlays.

**Position rules:**
- The back-rank pieces are shuffled into one of 960 valid configurations
- Bishops must start on opposite-colored squares
- The king must start on a square between the two rooks
- White and Black have mirrored back ranks
- Pawns start in their standard positions

**Castling:**
- Castling is still kingside or queenside conceptually
- After kingside castling, the king ends on the g-file and the rook on the f-file
- After queenside castling, the king ends on the c-file and the rook on the d-file
- Standard castling rules apply: king and rook must not have moved, path must be clear, king cannot move through or into check

**Implementation note:**
Chess960 castling is handled at the application level because the underlying chess library (chess.js) does not natively support Chess960. All other move generation and validation works normally from Chess960 starting positions.

**Bot support:**
Bots play from Chess960 starting positions using the same variant-aware move selection. The Blunznforön engine does not explicitly consider Chess960 castling in its search, but all regular moves are handled correctly.

## Termination / Precedence

Authoritative move resolution order:

1. Validate standard chess legality
2. Detect variant-mode-specific violation
3. Update King Hunt scores
4. Evaluate immediate terminal conditions:
   - Checkmate
   - King of the Hill (if enabled)
   - Stalemate / draw
   - King Hunt given-check-limit immediate win (if applicable)
   - King Hunt ply-limit outcome (if limit reached)
5. **If game is over: STOP — do not apply report or penalties**
6. If violation and game type is Report Incorrectness:
   - DCP overlay + severe → immediate loss
   - else → create reportable violation state
7. If violation and game type is Penalty on Miss:
   - apply penalties in deterministic order (additional move → piece removal → time reduction)
8. If penalty effects create a terminal condition: resolve and end
9. Handle extra-turn state; otherwise continue normally

**Important:** Checkmate always takes absolute precedence. A move producing checkmate ends the game immediately, regardless of violations.

## Supported Combinations

Examples of valid setups:

- Variant Mode: Classic Blunzinger / Game Type: Report Incorrectness / Overlays: Clock, King of the Hill
- Variant Mode: Reverse Blunzinger / Game Type: Penalty on Miss / Penalties: Additional move = 1, Piece removal = 2 / Overlays: Clock
- Variant Mode: Classic Blunzinger – King Hunt – Move Limit / Game Type: Penalty on Miss / Penalties: Time reduction = 60s / Overlays: Double Check Pressure, Clock
- Variant Mode: Classic Blunzinger / Game Type: Report Incorrectness / Overlays: Crazyhouse, Clock
- Variant Mode: Reverse Blunzinger / Game Type: Penalty on Miss / Overlays: Crazyhouse, King of the Hill
- Variant Mode: Classic Blunzinger / Game Type: Report Incorrectness / Overlays: Chess960, Clock
- Variant Mode: Classic Blunzinger – King Hunt – Move Limit / Game Type: Penalty on Miss / Overlays: Chess960, Crazyhouse

## Default Values

| Setting | Default |
|---------|---------|
| Clock initial time | 5 minutes |
| Additional move count | 1 |
| Piece removal count | 1 |
| Time reduction | 60 seconds |
| Invalid report threshold | 2 |
| King Hunt ply limit | 80 ply |
| King Hunt given-check target | 5 checks |

## Setup UI

The New Game setup screen presents:

1. **Variant Mode** selector (4 options)
2. **Game Type** selector (Report Incorrectness / Penalty on Miss)
3. **Player Mode** (Human vs Human / Human vs Bot / Bot vs Bot)
4. Bot settings (when applicable)
5. Variant-specific fields (ply limit, check target — shown when relevant)
6. Game-type-specific fields (report threshold / penalty checkboxes + values)
7. **Overlays / Options** checkboxes (King of the Hill, Clock, Double Check Pressure, Crazyhouse, Chess960)

Fields are shown/hidden based on selections. Irrelevant fields are not exposed.

## Active Game Summary

During play, a read-only summary shows the selected configuration:
- Variant Mode, Game Type, Player Mode
- Penalties (if Penalty on Miss)
- Overlays (King of the Hill, Clock, Double Check Pressure, Chess960)
- Variant-specific config (ply limit, check target)

## Evaluation Bar (Optional)

An optional evaluation bar can be enabled during play to show which side is currently better.

- **Off by default** — enable via the "Show evaluation bar" checkbox in game controls
- Displays a vertical bar next to the board: more white area = White is better, more black area = Black is better
- Shows a numeric score label (e.g. +1.8 / -0.6)
- Displays "M" followed by a number for mate-in-N situations
- **During post-game review**: evaluation recalculates for the currently viewed position

### Variant-Aware Evaluation

The evaluation bar is **variant-aware** — it does not just show standard chess evaluation. It incorporates:

- **Classic Blunzinger**: forced-check pressure (having checking moves is an advantage)
- **Reverse Blunzinger**: checking-avoidance pressure (few non-checking options is a disadvantage)
- **King Hunt – Move Limit**: current scores, proximity to ply limit, check-scoring opportunities
- **King Hunt – Given Check Limit**: proximity to the target check count
- **Report Incorrectness**: pending reportable violations strongly favor the reporting side
- **Penalty on Miss**: penalty strength affects the value of forcing violations
- **King of the Hill**: king proximity to center hill squares
- **Clock**: time remaining, with amplified effect for low-time situations
- **Double Check Pressure**: multiple required moves increase tactical pressure

**Important:** The evaluation is a heuristic estimate, not a perfect oracle. It uses material balance, mobility, and variant-specific game state to produce a practical approximation.

## Post-Game Review

After a game ends, a **review mode** activates automatically, allowing move-by-move inspection of the completed game.

### Features

- **Navigation controls**: step to first, previous, next, or last position using the `|◁ ◁ ▷ ▷|` buttons
- **Move list integration**: click any move in the move list to jump directly to that position; the current reviewed move is highlighted
- **Board updates**: the board shows the exact position at each reviewed step
- **Evaluation bar updates**: if enabled, the evaluation bar recalculates for the currently reviewed position — not just the final position
- **Position indicator**: shows the current step index (e.g. `5 / 23`)
- **Read-only**: review mode is purely navigational — no moves can be made, no reports can be filed, no penalties are applied
- **Game result remains visible**: the final result is always displayed alongside review controls
- **Piece removal steps**: if piece removal penalties occurred during the game, those board changes are included as separate review steps

### Review Steps

Each board-changing state transition is one review step:
- Normal chess moves
- Piece removals caused by penalties

The review accurately reflects what happened during the game, including variant-specific events.

### Variant-Aware Review

Review preserves the original match configuration. Evaluation during review uses the same variant mode, game type, and overlay settings that were active during the game.

## Player Modes

| Mode | Description |
|------|-------------|
| **Human vs Human** | Two players on the same device |
| **Human vs Bot** | Play against an AI (easy/medium/hard/expert) |
| **Bot vs Bot** | Watch two bots play with animated moves |

### Bot Levels

- **Easy**: Random legal move (respecting mode rules, occasional violations ~25%)
- **Medium**: Negamax search (depth 2) with variant-aware evaluation
- **Hard**: Deep negamax search (depth 3) with alpha-beta pruning, quiescence search, and tactical extensions
- **Expert (Blunznforön)**: Deepest search (depth 4) with fully deterministic, variant-aware evaluation — no randomization

### Bot Mode Awareness

Bots obey all mode restrictions:
- **Classic / King Hunt**: Must play checking moves when available
- **Reverse Blunzinger**: Must play non-checking moves when checking alternatives exist
- **King Hunt**: Prefers checking moves more strongly (higher scoring weight)
- **Penalty modes**: Functions correctly with penalties (extra turns, piece removal, time reduction)
- **Clock**: Consumes time normally; time pressure affects move evaluation
- **Piece removal (chooser)**: Selects piece by tactical impact (discovered checks, material value, king safety)
- **Crazyhouse**: Full support for drop moves as first-class candidates alongside regular moves

## Engines

The bot system is powered by **Blunznforön**, the app's native custom tactical bot. The **engine** system is a separate, pluggable layer that powers the optional **evaluation bar** and provides best-move hints.

| Engine | Status | Description |
|--------|--------|-------------|
| **Heuristic** | ✅ Available | Built-in lightweight evaluator using material balance and mobility. Powers the evaluation bar and 1-ply best-move hints. |
| **Blunznforön** | ✅ Available | Native custom tactical bot with negamax search, variant-aware evaluation, and Crazyhouse specialization. Especially strong in Blunziger + Crazyhouse combinations. |
| **Blunznfish** | ⏳ Coming soon | Custom engine built specifically for Blunziger Chess variants with native rule awareness. Not yet implemented. |

### Blunznforön

Blunznforön is the app's strong custom tactical bot for all Blunziger variants and Crazyhouse. It features:

- **Negamax search** with alpha-beta pruning for efficient tree traversal
- **Quiescence search** to avoid the horizon effect in tactical positions
- **Tactical extensions** that deepen search in check positions
- **MVV-LVA move ordering** for optimal pruning performance
- **Variant-aware evaluation** covering all variant modes, game types, and overlays
- **Crazyhouse specialization** including reserve evaluation, drop-check threats, mating-net detection, and king vulnerability to drops
- **Piece-square tables** for positional awareness
- **King safety** evaluation with pawn shield and castling bonuses

Blunznforön is the recommended engine for all Human vs Bot and Bot vs Bot games.

### Engine Architecture

Engines implement the `VariantEngineAdapter` interface (`src/core/engine/types.ts`) and are registered in a pluggable registry. Each engine can provide:

- **Position analysis** — evaluate who is better with a centipawn score
- **Best-move hints** — suggest the best move in UCI notation
- **Variant awareness** — factor variant rules into analysis (Blunznforön, planned for Blunznfish)

Engines are **advisory only** — the app's authoritative rules, violations, and match-state logic remain in `core/blunziger/`. Engine selection is available in Human vs Bot and Bot vs Bot modes, with per-side selection in Bot vs Bot.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
```

The output is in `dist/` — a fully static site.

### Run Tests

```bash
npm test
```

## Architecture

```
src/
├── core/blunziger/     # Pure TypeScript — no React/DOM deps
│   ├── types.ts        # VariantMode, GameType, MatchConfig, OverlayConfig, GameState, setup config
│   ├── engine.ts       # All pure game logic functions (variant-mode-aware)
│   └── index.ts        # Re-exports
├── core/evaluation/    # Pure TypeScript — variant-aware evaluation system
│   ├── types.ts        # EvaluationResult type
│   ├── evaluatePosition.ts  # Base chess position evaluation (material + mobility)
│   ├── evaluateVariant.ts   # Variant/game-type/overlay adjustments
│   ├── evaluate.ts     # Main evaluation orchestrator
│   └── index.ts        # Re-exports
├── core/engine/        # Pluggable engine abstraction (advisory evaluation + best-move)
│   ├── types.ts        # EngineId, EngineInfo, VariantEngineAdapter interface
│   ├── engineRegistry.ts  # Factory registry for engine adapters
│   ├── adapters/       # Engine adapter implementations
│   │   ├── heuristicAdapter.ts    # Built-in heuristic engine
│   │   ├── blunznforönAdapter.ts  # Blunznforön engine adapter (available)
│   │   └── shared.ts              # Shared utility functions
│   └── index.ts        # Re-exports
├── core/bots/blunznforon/  # Blunznforön tactical bot (variant-aware search engine)
│   ├── types.ts        # Bot configuration types
│   ├── config.ts       # Difficulty level configurations (easy/medium/hard/expert)
│   ├── evaluate.ts     # Variant-aware position evaluation (material, PST, mobility, king safety)
│   ├── search.ts       # Negamax with alpha-beta pruning, quiescence search
│   ├── moveOrdering.ts # MVV-LVA move ordering for search efficiency
│   ├── tactical.ts     # Tactical pattern detectors (mate, KOTH, checks)
│   ├── crazyhouse.ts   # Reserve evaluation, drop scoring, king vulnerability
│   ├── blunziger.ts    # Variant mode filtering (classic/reverse/King Hunt)
│   ├── kingHunt.ts     # King Hunt scoring evaluation
│   ├── clock.ts        # Time-aware evaluation adjustments
│   ├── pieceRemoval.ts # Piece removal decision logic
│   ├── reportLogic.ts  # Report action decision logic
│   └── index.ts        # Public API
├── bot/
│   └── botEngine.ts    # Bot move selection (delegates to Blunznforön when config available)
├── components/
│   ├── Chessboard.tsx        # Custom board UI (click-to-move, piece removal)
│   ├── EvaluationBar.tsx     # Optional evaluation bar (variant-aware)
│   ├── GameStatus.tsx        # Turn, clocks, scores, report, result, piece removal prompt
│   ├── GameControls.tsx      # New Game button + eval toggle + bot-vs-bot controls
│   ├── GameSummaryPanel.tsx  # Read-only settings summary during play
│   ├── NewGameSetupScreen.tsx # Pre-game setup with variant/game-type/overlay selectors
│   ├── MoveList.tsx          # Move history sidebar (click-to-jump in review mode)
│   ├── ReviewControls.tsx    # Post-game review navigation (first/prev/next/last)
│   └── RulesPanel.tsx        # Variant/game-type/overlay rule explanations
├── hooks/
│   ├── useGame.ts      # React game state hook (clocks, scores, extra turns, piece removal)
│   ├── useEvaluation.ts # Memoized evaluation hook
│   └── useReview.ts    # Post-game review navigation state hook
└── __tests__/
    ├── engine.test.ts    # Core logic tests
    ├── engine-adapter.test.ts # Engine abstraction layer tests
    ├── bot.test.ts       # Bot tests
    ├── modes.test.ts     # Variant mode, game type, overlay, combined penalty tests
    ├── evaluation.test.ts # Evaluation module tests (base + variant-aware)
    ├── evaluation-ui.test.tsx # Evaluation bar UI tests
    ├── review.test.tsx   # Post-game review system tests
    ├── app-flow.test.tsx # UI flow tests (setup, clock, penalty, game type)
    └── numeric-input.test.tsx # NumericInput component tests
```

### Separation of Concerns

- **`core/blunziger/`**: Pure functions, zero dependencies on React or the DOM. Can be reused server-side.
- **`core/evaluation/`**: Pure evaluation functions. Combines base chess evaluation with variant-aware adjustments.
- **`core/engine/`**: Pluggable engine adapters for evaluation bar and best-move hints. Engines are advisory — game rules stay in `core/blunziger/`.
- **`bot/`**: Bot logic, depends only on `core/` and `chess.js`.
- **`components/`**: React UI, depends on `core/` through the `useGame` and `useEvaluation` hooks.
- **`hooks/`**: Bridges core logic and React state. Manages clocks and evaluation memoization.

### Type System

| Type | Purpose |
|------|---------|
| `VariantMode` | One of 4 variant modes |
| `GameType` | `'report_incorrectness'` or `'penalty_on_miss'` |
| `MatchConfig` | Full immutable match configuration (variant + game type + overlays + configs) |
| `OverlayConfig` | Clock, King of the Hill, Double Check Pressure settings |
| `ReportGameTypeConfig` | Invalid report threshold |
| `PenaltyGameTypeConfig` | Penalty flags and configurable values |
| `VariantSpecificConfig` | King Hunt ply limit, given-check target |
| `VariantModeDefinition` | Name and description for a variant mode |
| `GameSetupConfig` | What the user selects before starting a game |
| `GameState` | Complete game state including scores, clocks, extra turns, pending piece removal, position history |
| `PositionHistoryEntry` | FEN, scores, and move notation for a single board-changing event (for review) |
| `EvaluationResult` | Evaluation output with score, normalized bar value, favored side, and explanation |
| `ViolationRecord` | Detected violation with type, severity, required moves |
| `PendingPieceRemoval` | State for piece removal penalty (target side, chooser side, removable squares, remaining count) |

### Pure Functions (core module)

| Function | Description |
|----------|-------------|
| `getLegalMoves(fen)` | All legal moves from position |
| `getCheckingMoves(fen)` | Legal moves that give check |
| `getNonCheckingMoves(fen)` | Legal moves that do NOT give check |
| `getRemovablePieces(fen, side)` | Squares with removable pieces (excludes king) |
| `isForcedCheckTurn(fen)` | Whether checking moves exist |
| `isReverseForcedState(fen)` | Whether checking moves exist (reverse context) |
| `detectViolation(fen, move, idx, variantMode, dcpEnabled)` | Detect variant-mode-aware violation |
| `applyMoveWithRules(state, move)` | Apply move with full variant-aware rules |
| `applyPieceRemoval(state, square)` | Remove a piece during piece removal penalty |
| `selectBestPieceForRemoval(fen, side)` | Bot heuristic for choosing which piece to remove |
| `canReport(state, side)` | Whether side can report (only in Report Incorrectness game type) |
| `reportViolation(state, side)` | Process a report |
| `applyTimeout(state, losingSide)` | End game due to clock timeout |
| `isKingOfTheHillEnabled(config)` | Whether KOTH overlay is on |
| `evaluateGameState(state, whiteMs, blackMs)` | Variant-aware position evaluation (evaluation module) |
| `evaluateBasePosition(fen)` | Base chess evaluation (material + mobility) |
| `evaluateVariantAdjustments(state, whiteMs, blackMs)` | Variant/game-type/overlay evaluation adjustments |

## Library Choices

| Library | License | Purpose |
|---------|---------|---------|
| **React** | MIT | UI framework |
| **TypeScript** | Apache-2.0 | Type safety |
| **Vite** | MIT | Build tool & dev server |
| **chess.js** | BSD-2-Clause | Chess move generation & validation |
| **Vitest** | MIT | Testing framework |

### Why No Chessground?

Chessground is GPL-licensed, which would require the entire project to be GPL. Instead, we built a **custom chessboard component** using React + CSS grid with Unicode chess pieces. This keeps the project under a permissive license.

## Licensing

This project uses only MIT/BSD/Apache-licensed dependencies. The custom board UI avoids any GPL contamination.

## Future Backend Plan

The `core/blunziger/` module is designed to be **backend-compatible**:

- Pure TypeScript with no browser APIs
- All functions are deterministic and stateless
- `GameState` is serializable (JSON-safe)
- Move validation is reproducible from state alone
- `MatchConfig` and `VariantModeDefinition` are portable

A future backend could:
- Import `core/blunziger/` directly into a Node.js server
- Add multiplayer via WebSocket
- Persist games in a database
- Implement Elo ratings and user accounts
- Run server-side bot computation
