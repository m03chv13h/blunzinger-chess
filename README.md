# Blunziger Chess ♟

A browser-based chess variant with a **multi-mode game system** built on top of standard chess.

## What is Blunziger Chess?

Blunziger Chess is standard chess with additional variant rules organized into **named game modes**. The core concept: forced-check constraints and scoring systems that add strategic depth.

## Game Mode System

The app ships with **6 built-in variant modes** selected before each game. Once a game starts, the mode and its config are **locked for the duration of the match**.

### Built-in Modes

| Mode | Key Rule |
|------|----------|
| **Classic Blunziger** | If a checking move exists, you are expected to play it. Opponent can report a miss for immediate loss. |
| **Double Check Pressure** | Like Classic, but if ≥2 checking moves exist and you miss them, you lose **immediately** (no report needed). |
| **Blitz Blunziger** | Classic Blunziger with chess clocks. Time runs out = loss. |
| **Penalty Instead of Loss** | Missing a forced check gives the opponent one **extra consecutive move** instead of loss. |
| **King Hunter** | Checks score points. Game ends at a move limit. Higher score wins. |
| **Reverse Blunziger** | If a checking move exists, you must **avoid** giving check. Violation = immediate loss. |

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

#### Penalty Instead of Loss
- Missing a forced check does **not** cause loss
- Instead, the opponent receives **one extra consecutive move**
- After the violating player's move, the opponent makes their normal move, then gets a second consecutive move
- Turn order resumes normally afterward
- The "Report Missed Check" button is **disabled** in this mode

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

When multiple rule systems are active, resolution order per move:
1. Validate move under standard chess legality
2. Detect mode-specific violations (Reverse Blunziger, Double Check Pressure)
3. Detect standard Blunziger violations
4. Apply the move
5. Update scores (King Hunter)
6. Evaluate termination: Checkmate → KOTH → Stalemate/Draw → Move limit

### Mode Combination Limitations

- **Reverse Blunziger** disables the standard Blunziger forced-check rule (they are mutually exclusive)
- King of the Hill can be enabled alongside any mode

## Game Flow

1. **New Game Setup** — Select a variant mode, player mode, and mode-specific options. Click **"Start Game"**.
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
- **Penalty mode**: Functions correctly with extra turns
- **Blitz**: Consumes time normally

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
│   ├── Chessboard.tsx        # Custom board UI (click-to-move)
│   ├── GameStatus.tsx        # Turn, clocks, scores, report, result
│   ├── GameControls.tsx      # New Game button + bot-vs-bot controls
│   ├── GameSummaryPanel.tsx  # Read-only settings summary during play
│   ├── NewGameSetupScreen.tsx # Pre-game setup with variant mode selector
│   ├── MoveList.tsx          # Move history sidebar
│   └── RulesPanel.tsx        # Mode-specific rule explanation
├── hooks/
│   └── useGame.ts      # React game state hook (clocks, scores, extra turns)
└── __tests__/
    ├── engine.test.ts    # 54 core logic tests
    ├── bot.test.ts       # 8 bot tests
    ├── modes.test.ts     # 38 mode-specific tests
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
| `GameState` | Complete game state including scores, clocks, extra turns |
| `GameSetupConfig` | What the user selects before starting a game |

### Pure Functions (core module)

| Function | Description |
|----------|-------------|
| `getLegalMoves(fen)` | All legal moves from position |
| `getCheckingMoves(fen)` | Legal moves that give check |
| `getNonCheckingMoves(fen)` | Legal moves that do NOT give check |
| `isForcedCheckTurn(fen)` | Whether checking moves exist |
| `isReverseForcedState(fen)` | Same as above (used for reverse mode context) |
| `detectViolation(fen, move, idx)` | Check if move is a standard Blunziger violation |
| `applyMoveWithRules(state, move)` | Apply move with full mode-aware rules |
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
