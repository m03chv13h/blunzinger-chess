# Blunziger Chess ♟

A browser-based chess variant that adds a **forced-check rule** on top of standard chess.

## What is Blunziger Chess?

Blunziger Chess is standard chess with one additional rule:

> **If you have any legal move that gives check, you are expected to play a checking move.**

However, the system **never forces** the move — players can still choose any legal move. If they don't play a checking move when one is available, that's a *missed forced-check violation*.

### Reporting System

After a violation occurs, the **opponent** can press **"Report Missed Check"** before making their next move:

- **Valid report**: The violating player **loses immediately**.
- **Invalid report** (no violation existed, or conditions not met): The reporter's invalid-report counter increments. After reaching the configured threshold (default: **2**), the reporter loses.

### Key Points

- Moves are **never auto-forced** — all legal moves are always available
- Violations are detected **after** the move is played
- Reports must be made **before** the reporter plays their next move
- Bots always obey the forced-check rule
- The invalid report threshold is configurable in the UI

## Game Modes

| Mode | Description |
|------|-------------|
| **Human vs Human** | Two players on the same device |
| **Human vs Bot** | Play against an AI (easy/medium/hard) |
| **Bot vs Bot** | Watch two bots play with animated moves |

### Bot Levels

- **Easy**: Random legal move (respecting forced-check rule)
- **Medium**: Heuristic evaluation (captures, checks, central control)
- **Hard**: Minimax with alpha-beta pruning (depth 3)

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
│   ├── types.ts        # GameState, ViolationRecord, configs
│   ├── engine.ts       # All pure game logic functions
│   └── index.ts        # Re-exports
├── bot/
│   └── botEngine.ts    # Bot move selection (easy/medium/hard)
├── components/
│   ├── Chessboard.tsx  # Custom board UI (click-to-move)
│   ├── GameStatus.tsx  # Turn indicator, report button, result
│   ├── GameControls.tsx # Mode/config/new game UI
│   ├── MoveList.tsx    # Move history sidebar
│   └── RulesPanel.tsx  # Expandable rule explanation
├── hooks/
│   └── useGame.ts      # React game state hook
└── __tests__/
    ├── engine.test.ts  # 32 core logic tests
    └── bot.test.ts     # 5 bot tests
```

### Separation of Concerns

- **`core/blunziger/`**: Pure functions, zero dependencies on React or the DOM. Can be reused server-side.
- **`bot/`**: Bot logic, depends only on `core/` and `chess.js`.
- **`components/`**: React UI, depends on `core/` through the `useGame` hook.
- **`hooks/`**: Bridges core logic and React state.

### Pure Functions (core module)

| Function | Description |
|----------|-------------|
| `getLegalMoves(fen)` | All legal moves from position |
| `getCheckingMoves(fen)` | Legal moves that give check |
| `isForcedCheckTurn(fen)` | Whether checking moves exist |
| `detectViolation(fen, move, idx)` | Check if move is a violation |
| `applyMoveWithRules(state, move)` | Apply move with Blunziger rules |
| `canReport(state, side)` | Whether side can report |
| `reportViolation(state, side)` | Process a report |
| `incrementInvalidReport(state, side)` | Bump invalid counter |
| `shouldLoseFromInvalidReports(counts, side, config)` | Check threshold |

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

A future backend could:
- Import `core/blunziger/` directly into a Node.js server
- Add multiplayer via WebSocket
- Persist games in a database
- Implement Elo ratings and user accounts
- Run server-side bot computation
