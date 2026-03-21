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

## C) Overlays / Options (3)

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
7. **Overlays / Options** checkboxes (King of the Hill, Clock, Double Check Pressure)

Fields are shown/hidden based on selections. Irrelevant fields are not exposed.

## Active Game Summary

During play, a read-only summary shows the selected configuration:
- Variant Mode, Game Type, Player Mode
- Penalties (if Penalty on Miss)
- Overlays (King of the Hill, Clock, Double Check Pressure)
- Variant-specific config (ply limit, check target)

## Evaluation Bar (Optional)

An optional evaluation bar can be enabled during play to show which side is currently better.

- **Off by default** — enable via the "Show evaluation bar" checkbox in game controls
- Displays a vertical bar next to the board: more white area = White is better, more black area = Black is better
- Shows a numeric score label (e.g. +1.8 / -0.6)
- Displays "M" followed by a number for mate-in-N situations

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

## Player Modes

| Mode | Description |
|------|-------------|
| **Human vs Human** | Two players on the same device |
| **Human vs Bot** | Play against an AI (easy/medium/hard) |
| **Bot vs Bot** | Watch two bots play with animated moves |

### Bot Levels

- **Easy**: Random legal move (respecting mode rules)
- **Medium**: Heuristic evaluation (captures, checks, central control)
- **Hard**: Minimax with alpha-beta pruning (depth 3)

### Bot Mode Awareness

Bots obey all mode restrictions:
- **Classic / King Hunt**: Must play checking moves when available
- **Reverse Blunzinger**: Must play non-checking moves when checking alternatives exist
- **King Hunt**: Prefers checking moves more strongly (higher scoring weight)
- **Penalty modes**: Functions correctly with penalties (extra turns, piece removal, time reduction)
- **Clock**: Consumes time normally
- **Piece removal (chooser)**: Automatically selects highest-value removable piece

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
├── bot/
│   └── botEngine.ts    # Bot move selection (variant-mode-aware, easy/medium/hard)
├── components/
│   ├── Chessboard.tsx        # Custom board UI (click-to-move, piece removal)
│   ├── EvaluationBar.tsx     # Optional evaluation bar (variant-aware)
│   ├── GameStatus.tsx        # Turn, clocks, scores, report, result, piece removal prompt
│   ├── GameControls.tsx      # New Game button + eval toggle + bot-vs-bot controls
│   ├── GameSummaryPanel.tsx  # Read-only settings summary during play
│   ├── NewGameSetupScreen.tsx # Pre-game setup with variant/game-type/overlay selectors
│   ├── MoveList.tsx          # Move history sidebar
│   └── RulesPanel.tsx        # Variant/game-type/overlay rule explanations
├── hooks/
│   ├── useGame.ts      # React game state hook (clocks, scores, extra turns, piece removal)
│   └── useEvaluation.ts # Memoized evaluation hook
└── __tests__/
    ├── engine.test.ts    # Core logic tests
    ├── bot.test.ts       # Bot tests
    ├── modes.test.ts     # Variant mode, game type, overlay, combined penalty tests
    ├── evaluation.test.ts # Evaluation module tests (base + variant-aware)
    ├── evaluation-ui.test.tsx # Evaluation bar UI tests
    ├── app-flow.test.tsx # UI flow tests (setup, clock, penalty, game type)
    └── numeric-input.test.tsx # NumericInput component tests
```

### Separation of Concerns

- **`core/blunziger/`**: Pure functions, zero dependencies on React or the DOM. Can be reused server-side.
- **`core/evaluation/`**: Pure evaluation functions. Combines base chess evaluation with variant-aware adjustments.
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
| `GameState` | Complete game state including scores, clocks, extra turns, pending piece removal |
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
