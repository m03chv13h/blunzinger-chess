# Blunziger Chess ♟

A browser-based chess variant with a **compositional multi-mode game system** built on top of standard chess.

## What is Blunziger Chess?

Blunziger Chess is standard chess with additional variant rules organized into **composable game modes**. The core concept: forced-check constraints, penalty systems, and scoring overlays that add strategic depth.

## Game Mode System

The app ships with **7 built-in variant presets** selected before each game. Modes are internally composed from independent rule layers: base rules, penalties, time control, and optional win conditions. Once a game starts, the mode and its config are **locked for the duration of the match**.

### Compositional Architecture

Internally, the mode system is organized into composable layers:

| Layer | Options |
|-------|---------|
| **Core play rules** | Classic Blunziger (forced check), Reverse Blunziger (forbidden check) |
| **Tactical modifier** | Double Check Pressure (≥2 checks missed = immediate loss) |
| **Penalty model** | Report loss, Extra move, Piece removal |
| **Time control overlay** | Blitz (chess clocks) — combinable with all modes |
| **Win condition overlays** | King of the Hill, King Hunter (score-based) |

### Built-in Presets

| Preset | Key Rule |
|--------|----------|
| **Classic Blunziger** | If a checking move exists, you are expected to play it. Opponent can report a miss for immediate loss. |
| **Double Check Pressure** | Like Classic, but if ≥2 checking moves exist and you miss them, you lose **immediately** (no report needed). |
| **Blitz Blunziger** | Classic Blunziger with chess clocks. Time runs out = loss. |
| **Penalty: Extra Move** | Missing a forced check gives the opponent one **extra consecutive move** instead of loss. |
| **Penalty: Piece Removal** | Missing a forced check removes one of the violator's pieces — opponent chooses which one. |
| **King Hunter** | Checks score points. Game ends at a move limit. Higher score wins. |
| **Reverse Blunziger** | If a checking move exists, you must **avoid** giving check. Violation = immediate loss. |

### Combinable Overlays

- **Blitz (Chess Clocks)**: Can be enabled as an overlay with **any** base preset via a checkbox in setup
- **King of the Hill**: Can be enabled as an overlay with any mode via a checkbox in setup

### Mode Details

#### Classic Blunziger
> If you have any legal move that gives check, you are expected to play a checking move.

- Moves are **never auto-forced** — all legal moves are always available
- Violations are detected **after** the move is played
- Opponent presses **"Report Missed Check"** before making their next move
- **Valid report**: violating player loses immediately
- **Invalid report**: reporter's counter increments; reaching the threshold (default: 2) → reporter loses

#### Double Check Pressure
Same as Classic Blunziger, plus:
- If **2 or more** checking moves exist and the player misses them → **immediate loss** (no report needed)
- If exactly **1** checking move exists and is missed → normal report-based handling

#### Blitz Blunziger
Classic Blunziger with countdown clocks:
- Each side starts with a configurable time (default: 5 minutes)
- Optional increment per move
- Time reaching zero → loss by **timeout**
- Clocks pause when the game ends

#### Penalty: Extra Move
- Missing a forced check does **not** cause loss
- Instead, the opponent receives **one extra consecutive move**
- After the violating player's move, the opponent makes their normal move, then gets a second consecutive move
- Turn order resumes normally afterward
- The "Report Missed Check" button is **disabled** in this mode
- **Clock Penalty (Blitz):** When combined with chess clocks, a missed forced check also subtracts a configurable number of seconds (default: 5) from the violating player's remaining time. If the clock reaches 0 from this penalty, that player loses immediately (result: `timeout_penalty`). The penalty amount is configurable in the setup screen.

#### Penalty: Piece Removal
- Missing a forced check does **not** cause loss
- Instead, one of the **violating player's pieces** is removed from the board
- The **opponent** chooses which piece to remove
- **Kings can never be removed**
- If the violator has no removable pieces (only king remains), the violator **loses immediately**
- The "Report Missed Check" button is **disabled** in this mode
- **Clock Penalty (Blitz):** When combined with chess clocks, a time penalty may also apply (same as Extra Move mode)

**Piece Removal Flow:**
1. Player commits a forced-check violation
2. Immediate terminal conditions (checkmate, etc.) are checked first
3. If the game is not over, a pending piece-removal state is entered
4. The opponent selects one removable piece from the violator's side
5. The piece is removed from the board
6. The game continues (or ends if the removal creates a terminal condition)

**Bot Behavior:** When a bot is the chooser, it automatically selects the highest-value removable piece (queen > rook > bishop/knight > pawn), with deterministic tie-breaking.

#### King Hunter
- Each time a player gives check, they score **1 point**
- Game ends after a configurable move limit (full moves, default: 40)
- Higher score wins; tied score = draw
- Checkmate before the move limit ends the game immediately
- Blunziger forced-check rules still apply by default

#### Reverse Blunziger
- If a checking move exists, you are **forbidden** from giving check
- You must play a non-checking legal move instead
- Violation (giving check when non-checking alternatives exist) = **immediate loss**
- **Exception**: If ALL legal moves give check, any move is allowed
- Reporting is **disabled** — violations are detected automatically

### King of the Hill (Optional Overlay)

King of the Hill can be **combined** with any mode via a checkbox in setup:
- A player wins immediately if their king reaches d4, e4, d5, or e5
- KOTH win overrides pending violations and draws

### Rule Precedence

When multiple rule systems are active, the authoritative move resolution order is:

1. Validate move under standard chess legality
2. Determine pre-move forced-check context
3. Apply move
4. Detect mode-specific violations (Reverse Blunziger, Double Check Pressure)
5. Detect standard Blunziger violations
6. Update scores (King Hunter)
7. **Evaluate immediate terminal conditions (checkmate → KOTH → stalemate/draw → move limit)**
8. **If the game is already over: STOP — do NOT enter penalty, extra-turn, report, or piece-removal flows**
9. If the game is not over and a violation occurred: apply the configured penalty
10. If penalty handling creates a terminal condition (e.g., clock timeout): resolve that

**Important:** Checkmate always takes absolute precedence over any penalty flow. A move that produces checkmate ends the game immediately, regardless of whether a forced-check violation also occurred.

### Supported Combinations

All of these combinations are cleanly supported:

- Blitz + Classic Blunziger
- Blitz + Double Check Pressure
- Blitz + Penalty: Extra Move
- Blitz + Penalty: Piece Removal
- Blitz + Reverse Blunziger
- Blitz + King Hunter
- Blitz + King of the Hill
- Any base preset + King of the Hill
- Blitz + base preset + King of the Hill

### Mode Combination Limitations

- **Reverse Blunziger** disables the standard Blunziger forced-check rule (they are mutually exclusive)
- Only one primary missed-check penalty type is active at a time (report loss, extra move, or piece removal)

## Game Flow

1. **New Game Setup** — Select a variant preset, player mode, optional overlays (Blitz, KOTH), and mode-specific options. Click **"Start Game"**.
2. **Active Game** — Board and game UI are shown. Settings are locked as a read-only summary. Click **"New Game"** to return to setup.

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
- **Classic/DCP**: Must play checking moves when available
- **Reverse Blunziger**: Must play non-checking moves when checking alternatives exist
- **King Hunter**: Prefers checking moves more strongly (higher scoring weight)
- **Penalty modes**: Functions correctly with extra turns and piece removal
- **Blitz**: Consumes time normally
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

## Deploy to GitHub Pages

1. Build the project: `npm run build`
2. The `dist/` folder contains all static assets
3. Configure GitHub Pages to serve from `dist/` or use a CI workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Architecture

```
src/
├── core/blunziger/     # Pure TypeScript — no React/DOM deps
│   ├── types.ts        # VariantConfig, GameModeDefinition, GameState, preset registry
│   ├── engine.ts       # All pure game logic functions (mode-aware)
│   └── index.ts        # Re-exports
├── bot/
│   └── botEngine.ts    # Bot move selection (mode-aware, easy/medium/hard)
├── components/
│   ├── Chessboard.tsx        # Custom board UI (click-to-move, piece removal)
│   ├── GameStatus.tsx        # Turn, clocks, scores, report, result, piece removal prompt
│   ├── GameControls.tsx      # New Game button + bot-vs-bot controls
│   ├── GameSummaryPanel.tsx  # Read-only settings summary during play
│   ├── NewGameSetupScreen.tsx # Pre-game setup with variant selector + overlays
│   ├── MoveList.tsx          # Move history sidebar
│   └── RulesPanel.tsx        # Mode-specific rule explanation
├── hooks/
│   └── useGame.ts      # React game state hook (clocks, scores, extra turns, piece removal)
└── __tests__/
    ├── engine.test.ts    # 54 core logic tests
    ├── bot.test.ts       # 8 bot tests
    ├── modes.test.ts     # 79 mode-specific tests (incl. composition, piece removal, checkmate precedence)
    └── app-flow.test.tsx # 16 UI flow tests
```

### Separation of Concerns

- **`core/blunziger/`**: Pure functions, zero dependencies on React or the DOM. Can be reused server-side.
- **`bot/`**: Bot logic, depends only on `core/` and `chess.js`.
- **`components/`**: React UI, depends on `core/` through the `useGame` hook.
- **`hooks/`**: Bridges core logic and React state. Manages clocks.

### Type System

| Type | Purpose |
|------|---------|
| `VariantConfig` | Full configuration for a variant (replaces old `BlunzigerConfig`) |
| `VariantModeId` | Identifier for a built-in mode preset |
| `GameModeDefinition` | Name, description, and default config for a preset |
| `GameState` | Complete game state including scores, clocks, extra turns, pending piece removal |
| `GameSetupConfig` | What the user selects before starting a game (incl. Blitz overlay toggle) |
| `PendingPieceRemoval` | State for piece removal penalty (target side, chooser side, removable squares) |

### Pure Functions (core module)

| Function | Description |
|----------|-------------|
| `getLegalMoves(fen)` | All legal moves from position |
| `getCheckingMoves(fen)` | Legal moves that give check |
| `getNonCheckingMoves(fen)` | Legal moves that do NOT give check |
| `getRemovablePieces(fen, side)` | Squares with removable pieces (excludes king) |
| `isForcedCheckTurn(fen)` | Whether checking moves exist |
| `isReverseForcedState(fen)` | Same as above (used for reverse mode context) |
| `detectViolation(fen, move, idx)` | Check if move is a standard Blunziger violation |
| `applyMoveWithRules(state, move)` | Apply move with full mode-aware rules |
| `applyPieceRemoval(state, square)` | Remove a piece during piece removal penalty |
| `selectBestPieceForRemoval(fen, side)` | Bot heuristic for choosing which piece to remove |
| `canReport(state, side)` | Whether side can report (disabled in penalty/reverse modes) |
| `reportViolation(state, side)` | Process a report |
| `applyTimeout(state, losingSide)` | End game due to clock timeout |
| `isKingOfTheHillEnabled(config)` | Whether KOTH mode is on |
| `isHillSquare(square)` | Whether square is a center hill square |
| `didKingReachHill(fen, side)` | Whether side's king is on a hill square |

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
- `VariantConfig` and `GameModeDefinition` are portable

A future backend could:
- Import `core/blunziger/` directly into a Node.js server
- Add multiplayer via WebSocket
- Persist games in a database
- Implement Elo ratings and user accounts
- Run server-side bot computation
