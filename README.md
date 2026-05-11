# Blunziger Chess ♟

A browser-based chess variant application with a **normalized variant architecture**, online multiplayer, and a full backend — built on top of standard chess.

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

## C) Overlays / Options (6)

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

### Atomic Chess (Optional)

When enabled, every capture triggers an **explosion** on the destination square. Atomic Chess can be combined with all variant modes, both game types, and all other overlays.

**Explosion rules:**
- On any capture, the capturing piece and captured piece are both destroyed
- All non-pawn pieces on the 8 surrounding squares are also destroyed
- Pawns are immune to adjacency explosions (but a pawn that is directly captured is still removed)
- If a rook is destroyed by an explosion, the corresponding castling right is lost

**Legality rules:**
- Kings may never capture (because that would explode the capturing king)
- A move is illegal if the resulting explosion would destroy the moving side's own king
- Kings may stand adjacent to each other since kings cannot capture

**Victory condition:**
- A player wins immediately by exploding the opponent's king without exploding their own
- Standard checkmate and other terminal conditions still apply when no king explosion occurs

**Interaction with Blunziger rules:**
- Checking/non-checking move detection uses Atomic-aware legality
- A capture that explodes the opponent's king counts as a "checking" move for variant rule purposes
- In Classic Blunzinger: if an explosion-check move exists, the player must play it
- In Reverse Blunzinger: explosion-check moves follow the same avoidance rules as standard checks
- An immediate king explosion win takes precedence over later penalty/report handling

**Evaluation:**
Atomic positions are evaluated with additional heuristics:
- Pieces clustered near a king are treated as liabilities (can chain-explode the king)
- Opponent pieces near their own king represent tactical opportunities
- King isolation (fewer adjacent non-pawn pieces) is rewarded

**Bot support:**
Bots only select Atomic-legal moves. The Blunznforön engine filters illegal Atomic captures from all candidate move lists, including the variant-aware filtering pipeline. Immediate king explosion wins are prioritized.

## Termination / Precedence

Authoritative move resolution order:

1. Validate standard chess legality
2. **Atomic explosion** (if Atomic enabled and move is a capture): apply explosion, check for king explosion win
3. Detect variant-mode-specific violation
4. Update King Hunt scores
5. Evaluate immediate terminal conditions:
   - Atomic king explosion (if enabled)
   - Checkmate
   - King of the Hill (if enabled)
   - Stalemate / draw
   - King Hunt given-check-limit immediate win (if applicable)
   - King Hunt ply-limit outcome (if limit reached)
6. **If game is over: STOP — do not apply report or penalties**
7. If violation and game type is Report Incorrectness:
   - DCP overlay + severe → immediate loss
   - else → create reportable violation state
8. If violation and game type is Penalty on Miss:
   - apply penalties in deterministic order (additional move → piece removal → time reduction)
9. If penalty effects create a terminal condition: resolve and end
10. Handle extra-turn state; otherwise continue normally

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
- Variant Mode: Classic Blunzinger / Game Type: Report Incorrectness / Overlays: Atomic Chess, Clock
- Variant Mode: Reverse Blunzinger / Game Type: Penalty on Miss / Overlays: Atomic Chess, King of the Hill
- Variant Mode: Classic Blunzinger – King Hunt – Move Limit / Game Type: Penalty on Miss / Overlays: Atomic Chess, Chess960

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

### Quick Start

A simplified game launcher for getting into a game immediately:

- Pre-configured with **Classic Blunzinger + Report Incorrectness**
- Select player mode (HvH / HvBot / BvB), bot difficulty, and side
- Optional clock with configurable time and increment
- **Online toggle** (connected mode) — creates a multiplayer room for HvH games

### New Game

The full New Game setup screen presents:

1. **Variant Mode** selector (4 options)
2. **Game Type** selector (Report Incorrectness / Penalty on Miss)
3. **Player Mode** (Human vs Human / Human vs Bot / Bot vs Bot)
4. Bot settings (when applicable)
5. Variant-specific fields (ply limit, check target — shown when relevant)
6. Game-type-specific fields (report threshold / penalty checkboxes + values)
7. **Overlays / Options** checkboxes (King of the Hill, Clock, Double Check Pressure, Crazyhouse, Chess960, Atomic Chess)

Fields are shown/hidden based on selections. Irrelevant fields are not exposed.

## Active Game Summary

During play, a read-only summary shows the selected configuration:
- Variant Mode, Game Type, Player Mode
- Penalties (if Penalty on Miss)
- Overlays (King of the Hill, Clock, Double Check Pressure, Chess960, Atomic Chess)
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

## Deployment Modes

The app supports two deployment modes controlled by the `VITE_DEPLOY_MODE` environment variable:

| Mode | Description |
|------|-------------|
| **`static`** (default) | Standalone client — no backend required. All game logic runs client-side. Auth, online play, and persistent game history are disabled. Deployed to GitHub Pages. |
| **`connected`** | Full backend integration. Enables OAuth authentication, online multiplayer, game persistence, user profiles, and server-side simulation. Deployed to Render. |

Features by mode:

| Feature | Static | Connected |
|---------|:------:|:---------:|
| Local play (HvH, HvBot, BvB) | ✅ | ✅ |
| All variant modes & overlays | ✅ | ✅ |
| Evaluation bar & review | ✅ | ✅ |
| Authentication | — | ✅ OAuth + Guest |
| Online multiplayer | — | ✅ SignalR |
| Game history persistence | In-memory only | ✅ Database |
| User profiles & avatars | — | ✅ |
| Server-side simulation | — | ✅ gRPC offloading |

## Online Multiplayer

When running in connected mode, the app supports **real-time online multiplayer** via SignalR WebSocket.

### Lobby System

- **Create Room** — host creates a private room with a short join code and chosen game configuration
- **Join Room** — guest joins by entering the room code
- **Browse Rooms** — view available waiting rooms
- **Matchmaking** — automatic opponent finding via a matchmaking queue

### Online Game Features

- **Real-time move relay** — moves are applied locally first, then relayed to the opponent via the SignalR hub
- **Host plays White, guest plays Black** — roles assigned at room creation
- **Draw offers** — either player can offer/accept a draw
- **Resignations** — immediate game termination
- **Takeback requests** — request to undo a move (opponent can accept or decline)
- **Disconnect handling** — opponent disconnection detection with reconnection support
- **Move validation** — the backend validates moves via the Node.js gRPC worker to prevent tampering
- **Room expiry** — idle rooms are automatically cleaned up

### Variant Support

Online games support the full range of variant modes, game types, and overlays — the same configuration options available in local play.

## Authentication

Connected mode provides multiple authentication methods:

| Method | Description |
|--------|-------------|
| **Guest** | Anonymous JWT — no account required, play immediately |
| **Google OAuth** | Sign in with Google |
| **GitHub OAuth** | Sign in with GitHub |
| **Discord OAuth** | Sign in with Discord |
| **Microsoft OAuth** | Sign in with Microsoft |

**Flow:**
1. User chooses a login method on the welcome screen
2. OAuth providers redirect to the backend, which issues a JWT on success
3. The JWT is stored in `localStorage` and attached to all API requests
4. Guest tokens are created via `POST /api/auth/guest`

## User Profiles & Avatars

Authenticated users have a profile with:

- **Display name** — editable, defaults to OAuth provider name or "Guest"
- **Avatar** — selectable from 15 sausage-themed presets (bratwurst, salami, blutwurst, weisswurst, frankfurter, chorizo, knackwurst, bockwurst, krakauer, blunze, kaesekrainer, eitrige, currywurst, depreziner, fleischwurst)
- **8 custom SVG avatars** — hand-drawn sausage artwork for select presets
- **OAuth provider data** — provider display name and avatar URL imported on first login
- **Game count** — total number of completed games

## Simulation System

The simulation system runs **automated bot-vs-bot games** for analysis:

- **Configure**: choose game count (1–100), variant mode, game type, overlays, and engine selection
- **Execute**: runs complete games without clocks (deterministic), capped at 600 ply per game
- **Review**: browse simulation results with standings, then review individual games move-by-move

| Mode | Execution |
|------|-----------|
| **Static** | Client-side — bot logic runs in the browser |
| **Connected** | Server-side — offloaded to the Node.js worker via gRPC for better performance |

Simulation records group multiple game results with aggregate statistics.

## Game History & Persistence

Completed games are recorded as `GameRecord` objects containing:
- Full configuration, result, and final position
- Complete position history and move history (for post-game review)
- Violation reports, missed checks, piece removals, and time reductions

| Mode | Storage |
|------|---------|
| **Static** | In-memory only — lost on page reload |
| **Connected** | Persisted to PostgreSQL via `POST /api/games` — paginated retrieval, deletion |

The **Analyse** section lets users browse completed games and simulation results, expanding simulation groups to review individual games.

## FEN Import & Position Analysis

The **Analyse Position** form allows:
- Pasting a FEN string with validation
- Selecting variant mode, game type, and overlays
- Live FEN preview on a mini board
- Starting a game from any valid position

The **FEN Display** component shows the current board position as a copyable FEN string during active games.

## Getting Started

### Prerequisites

- Node.js 20+ (backend worker requires Node.js 22)
- npm 9+
- .NET 10 SDK (backend only)
- PostgreSQL (backend only, or use Aspire)

### Frontend (Static Mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. Runs in static mode by default — no backend required.

### Frontend (Connected Mode)

```bash
VITE_DEPLOY_MODE=connected npm run dev
```

Requires the backend services to be running. The Vite dev server proxies `/api` and `/hubs` to `localhost:8080`.

### Backend

```bash
# .NET API (from repository root)
dotnet run --project backend/dotnet-api/BlunzigerChess.Api/BlunzigerChess.Api.csproj

# Node.js Worker
cd backend/node-worker
npm install
npx tsx src/server.ts
```

Or use .NET Aspire to orchestrate all backend services:

```bash
dotnet run --project backend/aspire/BlunzigerChess.AppHost/BlunzigerChess.AppHost.csproj
```

### Build for Production

```bash
npm run build
```

The output is in `dist/` — a fully static site.

### Run Tests

```bash
# Frontend unit & component tests (Vitest)
npm test

# Frontend lint
npm run lint

# System tests (Playwright — requires built frontend)
npm run test:system:local

# Backend API tests
dotnet test backend/dotnet-api/BlunzigerChess.Api.Tests/BlunzigerChess.Api.Tests.csproj

# Node worker type-check
cd backend/node-worker && npx tsc --noEmit
```

## CI/CD

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Deploy to GitHub Pages** (`deploy.yml`) | Push to `main` | Builds frontend in static mode, deploys to GitHub Pages |
| **Deploy to Render** (`deploy-render.yml`) | Push to `main` (backend changes), or manual | Triggers Render deploy and syncs `CONNECTION_STRING` secret |
| **Run Unit Tests** (`test.yml`) | Push to `main` | Runs Vitest frontend test suite |
| **Build Backend** (`backend.yml`) | Push/PR touching `backend/`, `src/core/`, `src/bot/` | Builds .NET API + Aspire, runs API tests, type-checks Node worker |
| **System Tests** (`system-tests.yml`) | After deploy, or manual trigger | Runs Playwright E2E tests against deployed or local build |

## Deployment

The app deploys to two platforms:

| Platform | Mode | Config |
|----------|------|--------|
| **GitHub Pages** | Static | `.github/workflows/deploy.yml` — fully client-side, no backend |
| **Render** | Connected | `render.yaml` + `.github/workflows/deploy-render.yml` — frontend static site + .NET API + Node worker + PostgreSQL |

The Render blueprint (`render.yaml`) provisions:
- **Frontend** — static site with SPA rewrites
- **.NET API** — Docker web service on port 8080
- **Node Worker** — private gRPC service on port 50051
- **PostgreSQL** — managed database

### Render Deployment & CONNECTION_STRING

The `.NET API` connects to PostgreSQL using the `CONNECTION_STRING` environment variable.
The connection string is a standard PostgreSQL URI (e.g. `postgres://user:pass@host:port/db`)
supplied by the database provider.

**How it works:**

1. `Program.cs` reads `CONNECTION_STRING` from the environment (falls back to `appsettings.json`).
2. `ConnectionStringHelper.Normalize()` converts the `postgres://` URI to ADO.NET key-value
   format (`Host=…;Port=…;Database=…;Username=…;Password=…;SSL Mode=Require;Trust Server Certificate=true`).
3. Npgsql uses the normalized connection string to connect to PostgreSQL.

**GitHub Secrets required for Render deployment:**

| Secret | Purpose |
|--------|---------|
| `CONNECTION_STRING` | PostgreSQL connection URI (e.g. `postgres://user:pass@host:port/db`). Synced to Render's `CONNECTION_STRING` env var via the deploy workflow. |
| `RENDER_SERVICE_ID` | The Render service ID for the `.NET API` service (found in Render dashboard URL). |
| `RENDER_API_KEY` | Render API key for triggering deploys and updating env vars ([Render API docs](https://render.com/docs/api)). |

**Setup steps:**

1. Add the PostgreSQL connection URI to your GitHub repository secrets as `CONNECTION_STRING`.
2. Add `RENDER_SERVICE_ID` (from the Render dashboard URL: `/services/srv-...`).
3. Add `RENDER_API_KEY` (generate at Render → Account Settings → API Keys).
4. The `deploy-render.yml` workflow will automatically trigger Render deployment and sync the
   connection string on every push to `main` that touches `backend/` or `render.yaml`.
5. You can also trigger the workflow manually via the Actions tab (`workflow_dispatch`).

## Architecture

### Frontend

```
src/
├── core/blunziger/     # Pure TypeScript — no React/DOM deps
│   ├── types.ts        # VariantMode, GameType, MatchConfig, OverlayConfig, GameState, setup config
│   ├── engine.ts       # All pure game logic functions (variant-mode-aware)
│   ├── atomic.ts       # Atomic Chess explosion and legality logic
│   ├── chess960.ts     # Chess960 position generation and castling
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
├── core/simulation.ts  # Synchronous bot-vs-bot game runner
├── core/gameRecord.ts  # Game record and simulation record types
├── bot/
│   ├── botEngine.ts    # Bot move selection (delegates to Blunznforön)
│   └── botWorker.ts    # Web Worker for non-blocking bot computation
├── config/
│   ├── deployMode.ts   # Static vs connected mode configuration
│   └── DeployModeContext.tsx  # React context for deploy mode
├── services/           # Backend API client layer (connected mode)
│   ├── apiClient.ts    # Base HTTP client with JWT and error handling
│   ├── authService.ts  # /api/auth endpoints (OAuth, guest, profile)
│   ├── lobbyService.ts # /api/lobby endpoints (rooms, matchmaking)
│   ├── gamesService.ts # /api/games endpoints (save, list, delete)
│   ├── userService.ts  # /api/user endpoints (profile management)
│   └── simulationService.ts  # /api/simulation endpoints
├── hooks/
│   ├── useGame.ts       # React game state hook (clocks, scores, extra turns, piece removal)
│   ├── useEvaluation.ts # Memoized evaluation hook
│   ├── useReview.ts     # Post-game review navigation state hook
│   ├── useAuth.ts       # Authentication state (JWT, OAuth, guest)
│   ├── useGameHub.ts    # SignalR multiplayer connection
│   ├── useLobby.ts      # Room and matchmaking management
│   ├── useGameHistory.ts # Persistent game record storage
│   ├── useSimulation.ts # Bot-vs-bot simulation runner
│   └── useUserProfile.ts # User profile CRUD
├── components/
│   ├── Chessboard.tsx        # Custom board UI (click-to-move, piece removal)
│   ├── EvaluationBar.tsx     # Optional evaluation bar (variant-aware)
│   ├── GameStatus.tsx        # Turn, clocks, scores, report, result, piece removal prompt
│   ├── GameControls.tsx      # New Game button + eval toggle + bot-vs-bot controls
│   ├── GameSummaryPanel.tsx  # Read-only settings summary during play
│   ├── QuickStartScreen.tsx  # Quick game setup (Classic Blunzinger preset)
│   ├── NewGameSetupScreen.tsx # Full pre-game setup with all configuration
│   ├── MoveList.tsx          # Move history sidebar (click-to-jump in review mode)
│   ├── ReviewControls.tsx    # Post-game review navigation (first/prev/next/last)
│   ├── RulesPanel.tsx        # Variant/game-type/overlay rule explanations
│   ├── RulesPage.tsx         # Full rules reference page
│   ├── CrazyhouseReserve.tsx # Crazyhouse piece reserve display
│   ├── FenDisplay.tsx        # Copyable FEN position display
│   ├── AnalysePositionForm.tsx # FEN import and position analysis
│   ├── AnalyseSection.tsx    # Game and simulation history browser
│   ├── SimulationSetupScreen.tsx # Bot-vs-bot simulation configuration
│   ├── SimulationView.tsx    # Simulation results and standings
│   ├── WelcomeScreen.tsx     # Login screen (connected mode)
│   ├── OnlineScreen.tsx      # Online play screen dispatcher
│   ├── OnlineLobbyScreen.tsx # Room creation and joining
│   ├── OnlineGameScreen.tsx  # Live multiplayer game
│   ├── ProfileSettingsScreen.tsx # User profile and avatar editor
│   ├── MiniBoard.tsx         # Small board preview (FEN analysis)
│   ├── Sidebar.tsx           # Navigation sidebar with section routing
│   ├── avatarPresets.ts      # 15 sausage-themed avatar presets
│   └── sausageAvatars.tsx    # 8 custom SVG avatar illustrations
└── __tests__/
    ├── unit/                 # Pure logic tests (16 files)
    │   ├── engine.test.ts, modes.test.ts, evaluation.test.ts, bot.test.ts
    │   ├── blunznforon.test.ts, chess960.test.ts, atomic.test.ts, crazyhouse.test.ts
    │   ├── clock.test.ts, simulation.test.ts, engine-adapter.test.ts
    │   ├── avatar-presets.test.ts, simulation-record.test.ts
    │   ├── gameDetailToRecord.test.ts, specific-fen.test.ts, test_position.test.ts
    ├── components/           # React UI tests (22 files)
    │   ├── app-flow.test.tsx, game-status.test.tsx, move-list.test.tsx, review.test.tsx
    │   ├── evaluation-ui.test.tsx, numeric-input.test.tsx, time-input.test.tsx
    │   ├── fen-display.test.tsx, game-summary-panel.test.tsx, report-issue.test.tsx
    │   ├── quick-start-online.test.tsx, welcome-screen.test.tsx
    │   ├── online-screen.test.tsx, online-lobby.test.tsx, online-game-screen.test.tsx
    │   ├── simulation-ui.test.tsx, analyse-section.test.tsx, analyse-position-form.test.tsx
    │   ├── profile-settings.test.tsx, crazyhouse-dnd.test.tsx
    │   ├── error-resilience.test.tsx, logout-redirect.test.tsx
    └── services/             # API client tests (4 files)
        ├── apiClient.test.ts, authService.test.ts
        ├── lobbyService.test.ts, simulationService.test.ts
```

### Backend

```
backend/
├── dotnet-api/BlunzigerChess.Api/
│   ├── Controllers/        # REST API endpoints
│   │   ├── AuthController.cs       # OAuth login, guest tokens, JWT
│   │   ├── GamesController.cs      # Game record CRUD
│   │   ├── LobbyController.cs      # Room and matchmaking management
│   │   ├── SimulationController.cs # Backend simulation execution
│   │   └── UserController.cs       # User profile management
│   ├── Hubs/
│   │   └── GameHub.cs      # SignalR hub for real-time multiplayer
│   ├── Services/
│   │   ├── AuthService.cs           # OAuth + JWT token generation
│   │   ├── MatchmakingService.cs    # Opponent matching queue
│   │   ├── RoomExpiryService.cs     # Background room cleanup
│   │   └── EnabledOAuthProviders.cs # Runtime OAuth provider discovery
│   ├── GrpcClients/
│   │   └── GameEngineClient.cs      # gRPC client to Node.js worker
│   ├── Data/
│   │   └── AppDbContext.cs          # Entity Framework Core context
│   ├── Models/
│   │   ├── User.cs, Game.cs, MultiplayerRoom.cs, MatchmakingEntry.cs
│   └── Dockerfile          # Multi-stage .NET 10 build
├── dotnet-api/BlunzigerChess.Api.Tests/  # Backend unit tests
├── node-worker/
│   ├── src/
│   │   ├── server.ts       # gRPC server entry point
│   │   └── services/       # Game logic, bot, evaluation, simulation
│   └── Dockerfile          # Node 22 Alpine build
├── aspire/                 # .NET Aspire local orchestration
│   ├── BlunzigerChess.AppHost/
│   └── BlunzigerChess.ServiceDefaults/
└── proto/                  # gRPC service definitions
    ├── common.proto, game_logic.proto, bot.proto
    ├── evaluation.proto, simulation.proto
```

### Separation of Concerns

- **`core/blunziger/`**: Pure functions, zero dependencies on React or the DOM. Reused server-side by the Node.js worker.
- **`core/evaluation/`**: Pure evaluation functions. Combines base chess evaluation with variant-aware adjustments.
- **`core/engine/`**: Pluggable engine adapters for evaluation bar and best-move hints. Engines are advisory — game rules stay in `core/blunziger/`.
- **`bot/`**: Bot logic, depends only on `core/` and `chess.js`.
- **`config/`**: Deploy mode configuration and React context.
- **`services/`**: Backend API client layer — all REST and auth communication.
- **`hooks/`**: Bridges core logic, backend services, and React state. Manages clocks, auth, multiplayer, and evaluation.
- **`components/`**: React UI, depends on `core/` through hooks.
- **`backend/dotnet-api/`**: .NET API — auth, persistence, multiplayer hub, gRPC delegation.
- **`backend/node-worker/`**: TypeScript gRPC server reusing `src/core/` for server-side logic.

### Type System

| Type | Purpose |
|------|---------|
| `VariantMode` | One of 4 variant modes |
| `GameType` | `'report_incorrectness'` or `'penalty_on_miss'` |
| `GameMode` | `'hvh'` / `'hvbot'` / `'botvbot'` |
| `BotLevel` | `'easy'` / `'medium'` / `'hard'` |
| `MatchConfig` | Full immutable match configuration (variant + game type + overlays + configs) |
| `OverlayConfig` | Clock, King of the Hill, Double Check Pressure, Crazyhouse, Chess960, Atomic settings |
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
| `GameRecord` | Completed game record with config, result, full history, violations, penalties |
| `SimulationRecord` | Groups multiple game records with aggregate standings |
| `CrazyhouseState` | Reserve pieces and drop tracking for Crazyhouse overlay |
| `Chess960State` | Position index and castling state for Chess960 overlay |
| `GameResultReason` | Discriminated union of all terminal condition reasons |

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
| `isAtomicEnabled(config)` | Whether Atomic overlay is on |
| `getExplosionSquares(square)` | 8 adjacent squares for explosion blast radius |
| `applyExplosionToFen(fen, square)` | Apply Atomic explosion to FEN |
| `getAtomicLegalMoves(fen)` | Legal moves filtered for Atomic rules |
| `evaluateGameState(state, whiteMs, blackMs)` | Variant-aware position evaluation (evaluation module) |
| `evaluateBasePosition(fen)` | Base chess evaluation (material + mobility) |
| `evaluateVariantAdjustments(state, whiteMs, blackMs)` | Variant/game-type/overlay evaluation adjustments |

### Backend Architecture

The backend is a multi-tier system deployed to Render:

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│   Frontend   │─────▶│   .NET API       │─────▶│   Node.js Worker    │
│   (Static)   │ REST │   (ASP.NET 10)   │ gRPC │   (TypeScript)      │
│              │  +   │                  │      │                     │
│              │  WS  │   PostgreSQL DB  │      │   Port 50051        │
└──────────────┘      └──────────────────┘      └─────────────────────┘
```

**.NET API** — ASP.NET 10 web API handling authentication, game persistence, multiplayer coordination, and gRPC delegation.

| Controller | Endpoints | Purpose |
|-----------|-----------|---------|
| `AuthController` | `/api/auth/*` | OAuth login, guest tokens, JWT management |
| `GamesController` | `/api/games/*` | Save, list, fetch, delete game records |
| `LobbyController` | `/api/lobby/*` | Room creation/joining, matchmaking queue |
| `SimulationController` | `/api/simulation/*` | Backend simulation execution |
| `UserController` | `/api/user/*` | Profile management (display name, avatar) |

**SignalR:** `GameHub` at `/hubs/game` for real-time multiplayer game state synchronization.

**Services:** `AuthService` (OAuth + JWT), `MatchmakingService` (queue-based matching), `RoomExpiryService` (idle room cleanup), `EnabledOAuthProviders` (runtime OAuth discovery).

**Database:** Entity Framework Core with PostgreSQL — entities: `User`, `MultiplayerRoom`, `Game`, `MatchmakingEntry`.

**Node.js Worker** — TypeScript gRPC server reusing `src/core/` for server-side logic:

| gRPC Service | Proto | Purpose |
|---------|-------|---------|
| `GameLogicService` | `game_logic.proto` | Move validation, rule application |
| `BotService` | `bot.proto` | Bot move selection |
| `EvaluationService` | `evaluation.proto` | Position evaluation |
| `SimulationService` | `simulation.proto` | Bot-vs-bot game simulation |

The worker uses JSON passthrough — the .NET API forwards raw frontend JSON strings, and the Node.js worker parses them natively using the shared TypeScript types from `src/core/`.

**.NET Aspire** — Development orchestration for running all backend services locally with service discovery.

## Library Choices

| Library | License | Purpose |
|---------|---------|---------|
| **React 19** | MIT | UI framework |
| **TypeScript 5.9** | Apache-2.0 | Type safety (strict mode) |
| **Vite** | MIT | Build tool & dev server |
| **chess.js** | BSD-2-Clause | Chess move generation & validation |
| **@microsoft/signalr** | MIT | Real-time WebSocket communication (online multiplayer) |
| **Vitest** | MIT | Unit & component testing framework |
| **Playwright** | Apache-2.0 | End-to-end system testing |

### Why No Chessground?

Chessground is GPL-licensed, which would require the entire project to be GPL. Instead, we built a **custom chessboard component** using React + CSS grid with Unicode chess pieces. This keeps the project under a permissive license.

## Licensing

This project uses only MIT/BSD/Apache-licensed dependencies. The custom board UI avoids any GPL contamination.
