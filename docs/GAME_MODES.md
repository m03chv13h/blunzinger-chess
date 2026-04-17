# Blunziger Chess — Complete Game Modes & Combinations Reference

> A deep analysis of every variant mode, game type, overlay, player mode, and their
> interactions — including all corner cases and edge-case behaviors.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Variant Modes](#2-variant-modes)
   - [Classic Blunzinger](#21-classic-blunzinger)
   - [Reverse Blunzinger](#22-reverse-blunzinger)
   - [King Hunt — Move Limit](#23-king-hunt--move-limit)
   - [King Hunt — Given Check Limit](#24-king-hunt--given-check-limit)
3. [Game Types](#3-game-types)
   - [Report Incorrectness](#31-report-incorrectness)
   - [Penalty on Miss](#32-penalty-on-miss)
4. [Overlays](#4-overlays)
   - [King of the Hill](#41-king-of-the-hill)
   - [Clock](#42-clock)
   - [Double Check Pressure](#43-double-check-pressure)
   - [Crazyhouse](#44-crazyhouse)
   - [Chess960](#45-chess960)
   - [Atomic Chess](#46-atomic-chess)
5. [Player Modes](#5-player-modes)
6. [Bot Difficulty Levels](#6-bot-difficulty-levels)
7. [Violation Detection](#7-violation-detection)
8. [Penalty Mechanics](#8-penalty-mechanics)
   - [Extra Turns](#81-extra-turns)
   - [Piece Removal](#82-piece-removal)
   - [Time Reduction](#83-time-reduction)
9. [Game Termination](#9-game-termination)
10. [Configuration Reference](#10-configuration-reference)
11. [Combination Matrix](#11-combination-matrix)
12. [Corner Cases & Edge Cases](#12-corner-cases--edge-cases)
13. [Default Configuration](#13-default-configuration)

---

## 1. Overview

Blunziger Chess layers **forced-check variant rules** on top of standard chess. A game
is fully configured by choosing three independent axes and then optionally enabling
composable overlays:

| Axis | Options |
|------|---------|
| **Variant Mode** | Classic Blunzinger · Reverse Blunzinger · King Hunt — Move Limit · King Hunt — Given Check Limit |
| **Game Type** | Report Incorrectness · Penalty on Miss |
| **Player Mode** | Human vs Human · Human vs Bot · Bot vs Bot |
| **Overlays** (any combination) | King of the Hill · Clock · Double Check Pressure · Crazyhouse · Chess960 · Atomic Chess |

Every combination of variant mode × game type × overlay set × player mode is valid and
fully supported by the game engine.

---

## 2. Variant Modes

Variant modes define the **core forced-move mechanic** — the central rule that
distinguishes Blunziger Chess from standard chess.

### 2.1 Classic Blunzinger

**ID:** `classic_blunzinger`

**Rule:** If a player has **any legal move that gives check**, they **must** play a
checking move. Playing a non-checking move when a checking move exists is a **violation**.

| Property | Value |
|----------|-------|
| Forced-check direction | Must give check |
| Violation type | `missed_check` |
| When no checking moves exist | Any legal move is allowed |
| Checking move count affects violation? | No — any single checking move is sufficient |

**Example:**
- White has moves Qd1, Qh5+, Nf3. Because Qh5+ gives check, White **must** play Qh5+.
  Playing Qd1 or Nf3 would be a violation.

---

### 2.2 Reverse Blunzinger

**ID:** `reverse_blunzinger`

**Rule:** If checking moves exist **but non-checking alternatives are also available**,
the player **must** play a non-checking move. Giving check when it can be avoided is a
**violation**.

**Exception:** If **all** legal moves give check, any move is allowed — no violation is
possible on that turn.

| Property | Value |
|----------|-------|
| Forced-check direction | Must avoid check |
| Violation type | `gave_forbidden_check` |
| When all moves give check | Any move is allowed |
| When no checking moves exist | Any legal move is allowed (trivially satisfied) |

**Example:**
- Black has moves Bb7, Rxe1+, Nf6. Because Bb7 and Nf6 are non-checking, Black must
  play one of those. Playing Rxe1+ would be a violation.
- If Black's only moves are Rxe1+ and Qd1+, both give check — any move is allowed.

---

### 2.3 King Hunt — Move Limit

**ID:** `classic_king_hunt_move_limit`

**Rule:** Uses **Classic Blunzinger forced-check rules** (must give check if possible),
combined with **score tracking**. Each successful check scores **1 point**. The game ends
when the configured **ply limit** is reached.

| Property | Value |
|----------|-------|
| Forced-check direction | Must give check (same as Classic) |
| Scoring | +1 point per check given |
| Termination | At configured ply limit (default: 80 plies = 40 full moves) |
| Winner at limit | Higher score wins |
| Tied score at limit | Draw (`king_hunt_ply_limit_draw`) |
| Checkmate before limit? | Ends the game immediately |
| Config field | `variantSpecific.kingHuntPlyLimit` |

**Example:**
- After 80 plies, White has given 12 checks and Black has given 9.
  White wins (`king_hunt_ply_limit`).

---

### 2.4 King Hunt — Given Check Limit

**ID:** `classic_king_hunt_given_check_limit`

**Rule:** Uses **Classic Blunzinger forced-check rules**, combined with **score
tracking**. The first player to reach the configured **given check target** wins
immediately.

| Property | Value |
|----------|-------|
| Forced-check direction | Must give check (same as Classic) |
| Scoring | +1 point per check given |
| Termination | First player to reach target (default: 5 checks) |
| Winner | First to reach target |
| Checkmate before target? | Ends the game immediately (takes precedence) |
| Config field | `variantSpecific.kingHuntGivenCheckTarget` |

**Example:**
- White gives their 5th check. White wins immediately
  (`king_hunt_given_check_limit`).

---

## 3. Game Types

Game types determine **how violations are resolved**. They are independent of the
variant mode.

### 3.1 Report Incorrectness

**ID:** `report_incorrectness`

When a violation occurs, the game **continues silently**. The opponent may choose to
press **"Report Violation"** before making their next move.

#### Valid Report

The violation actually existed — the reporting player wins immediately.

- Result reason: `valid-report`
- The violation is cleared from the reportable state

#### Invalid Report

No reportable violation existed — the reporter's invalid-report counter increments.

- Counter: `invalidReports[reportingSide] += 1`
- If the counter reaches the configured threshold (default: **2**), the reporter
  **loses** immediately
- Result reason: `invalid-report-threshold`
- Feedback message: e.g. *"Wrong! (1/2 invalid reports)"*

#### Interaction with Double Check Pressure

When the DCP overlay is enabled and the violation is **severe** (2+ required moves
existed), the violator loses **immediately** — no report needed.

- Result reason: `double_check_pressure_violation`

| Config field | Default |
|--------------|---------|
| `reportConfig.invalidReportLossThreshold` | 2 |

---

### 3.2 Penalty on Miss

**ID:** `penalty_on_miss`

Violations are detected and **penalized automatically** — there is no reporting phase.
Up to three penalty types can be independently enabled. When multiple are enabled, they
are applied in the following deterministic order:

1. **Additional Move Penalty** — opponent receives extra consecutive turn(s)
2. **Piece Removal Penalty** — opponent chooses the violator's piece(s) to remove
3. **Time Reduction Penalty** — seconds subtracted from the violator's clock

Penalties are applied **only if the move did not already end the game** (checkmate,
King of the Hill win, atomic king explosion, etc.).

If a penalty itself creates a terminal condition (e.g., piece removal leaves only a
king, time reduction reaches 0), the game ends immediately.

| Config field | Default | Notes |
|--------------|---------|-------|
| `penaltyConfig.enableAdditionalMovePenalty` | `false` | |
| `penaltyConfig.additionalMoveCount` | `1` | Extra turns per violation |
| `penaltyConfig.enablePieceRemovalPenalty` | `false` | |
| `penaltyConfig.pieceRemovalCount` | `1` | Pieces removed per violation |
| `penaltyConfig.enableTimeReductionPenalty` | `false` | Requires clock overlay |
| `penaltyConfig.timeReductionSeconds` | `60` | Seconds deducted |

---

## 4. Overlays

Overlays are **composable rule additions** that can be independently enabled or
disabled. Any combination of overlays works with any variant mode and game type.

### 4.1 King of the Hill

A player wins **immediately** if their king reaches one of the four center squares:
**d4, e4, d5, or e5**.

- Checked after every move (including extra turns)
- Result reason: `king_of_the_hill`
- **Precedence:** Checkmate and atomic king explosion are evaluated before KOTH

**Interaction with variant rules:**
- King moves must still obey forced-check rules — moving a king to a center square
  when a checking move exists (Classic) may still be a violation
- Can end King Hunt variants early if a center square is reached before the ply/check
  limit

---

### 4.2 Clock

Each side starts with the same time budget. If a player's time reaches zero, they lose.

| Config field | Default | Description |
|--------------|---------|-------------|
| `overlays.initialTimeMs` | 300,000 ms (5 min) | Starting time per side |
| `overlays.incrementMs` | 0 | Time added per move |
| `overlays.decrementMs` | 0 | Time subtracted per move |

- Result reason on timeout: `timeout`
- All pending actions (piece removal, reportable violations) are cleared on timeout
- Clock continues running during extra turns and piece-removal selection
- If the chooser times out during piece removal, the **chooser** loses (not the
  violator)

**Interaction with penalties:**
- Time reduction penalty only applies when the clock is enabled
- If time reduction brings clock to 0: result reason `timeout_penalty`

---

### 4.3 Double Check Pressure

When 2 or more required moves exist and the player misses the requirement, the
violation is marked as **severe**.

| Game Type | Severe Violation Effect |
|-----------|----------------------|
| **Report Incorrectness** | Immediate loss — no report needed (`double_check_pressure_violation`) |
| **Penalty on Miss** | No additional effect — penalties applied normally |

**Severity calculation:**
```
severe = dcpEnabled AND (regularRequiredMoves.length + dropRequiredMoves.length) >= 2
```

- Applies to both regular move violations and piece-removal violations
- Drop moves (Crazyhouse) count toward the required-move total

---

### 4.4 Crazyhouse

Captured pieces enter the opponent's **reserve** and can be dropped back onto the board
as new moves.

#### Reserve

Each player maintains a reserve of captured pieces:

| Piece | Notation |
|-------|----------|
| Pawn | `p` |
| Knight | `n` |
| Bishop | `b` |
| Rook | `r` |
| Queen | `q` |

Kings can never enter the reserve.

#### Drop Move Rules

- **Notation:** `N@d4` (piece type @ destination square)
- Cannot drop on occupied squares
- Pawns cannot be dropped on rank 1 or rank 8
- Drop must not leave own king in check
- Drop must obey variant rules (forced-check / reverse-check)

#### Drops and Variant Rules

Drop moves participate fully in violation detection:

- **Classic mode:** If checking moves exist (regular or drop), a non-checking drop is a
  violation
- **Reverse mode:** If non-checking moves exist (regular or drop), a checking drop is a
  violation

#### Capture → Reserve

- When a piece is captured, it immediately enters the capturing side's reserve
- **Atomic + Crazyhouse:** Explosion victims also enter the capturing side's reserve
- Kings can never enter reserves

#### Related Functions

| Function | Purpose |
|----------|---------|
| `getCrazyhouseDropMoves()` | All legal drops from reserve |
| `getCheckingDropMoves()` | Drops that give check |
| `getNonCheckingDropMoves()` | Drops that don't give check |
| `applyDropMoveWithRules()` | Full variant-aware drop application |

---

### 4.5 Chess960

The starting position is randomized from **960 legal positions** according to Fischer
Random Chess rules.

#### Position Generation (Scharnagl Numbering)

Each of the 960 positions is indexed 0–959. Position **518** equals the standard
starting position. The algorithm:

1. Dark-square bishop placed on one of files b, d, f, h (4 options)
2. Light-square bishop placed on one of files a, c, e, g (4 options)
3. Queen placed on one of 6 remaining squares (6 options)
4. Two knights placed via C(5,2) encoding (10 options)
5. Remaining 3 squares filled Rook–King–Rook left to right

Total: 4 × 4 × 6 × 10 = **960**

#### Castling Rules in Chess960

- King must not have moved from starting file
- Rook must not have moved from starting file
- All squares between king and target must be vacant (or occupied only by the castling
  pieces themselves)
- King may not start in check, pass through check, or land in check
- **Destinations:** King ends on g-file (kingside) or c-file (queenside); rook ends on
  f-file (kingside) or d-file (queenside)

#### Chess960 State

Tracked in `Chess960State`:
- `kingFile` — starting file of the king
- `queenSideRookFile` — starting file of the a-side rook
- `kingSideRookFile` — starting file of the h-side rook
- Castling flags (updated after each move)

#### Integration with Variants

- Works with all variant modes and game types
- Castling moves participate in violation detection (checking/non-checking)
- Compatible with Atomic and Crazyhouse overlays

---

### 4.6 Atomic Chess

On capture, an **explosion** destroys the capturing piece, the captured piece, and all
non-pawn pieces on the 8 surrounding squares.

#### Explosion Mechanics

- **Trigger:** Any capture (regular moves only — not drops)
- **Blast radius:** Capture square + 8 adjacent squares (maximum 9 squares)
- **Destroyed:** Capturing piece + all non-pawn pieces in blast radius
- **Immune:** Pawns survive adjacency explosions (but a directly captured pawn is
  removed)
- **Kings:** Never destroyed by explosion — a move is illegal if it would explode your
  own king

#### King Safety

- **Kings cannot capture** (would self-destruct)
- **Kings may never be exploded** (move is illegal if own king is in blast radius of the
  capture)
- **Kings may stand adjacent** (since they cannot capture each other)

#### Immediate Win

If an explosion destroys the **opponent's king**, the capturing side wins immediately.

- Result reason: `atomic_king_explosion`

#### Move Legality

`getAtomicLegalMoves()` filters out:
- King captures (king would self-destruct)
- Captures that would explode your own king

Non-capture moves and castling are unaffected.

#### Check Detection in Atomic

- **Non-capture moves:** Standard chess.js check detection
- **Capture moves:**
  1. If explosion kills opponent's king → counts as giving check (immediate win)
  2. Otherwise: apply explosion to the FEN, then check if opponent is in check

#### Interaction with Crazyhouse

- Directly captured piece enters the capturing side's reserve
- Explosion victims **also** enter the capturing side's reserve
- Example: White captures on e4; explosion destroys a black rook on d3. Both the
  captured piece and the rook enter White's reserve.

#### Interaction with Variant Rules

- Forced-check rules apply normally using Atomic-aware checking-move detection
- Check scoring in King Hunt modes uses Atomic-aware detection
- Atomic-specific checkmate/stalemate detection is needed **after** chess.js standard
  checks, because chess.js doesn't know about Atomic move restrictions

---

## 5. Player Modes

| Mode | ID | Description |
|------|----|-------------|
| **Human vs Human** | `hvh` | Two players on the same device, alternating turns |
| **Human vs Bot** | `hvbot` | One human plays against a computer opponent |
| **Bot vs Bot** | `botvbot` | Two bots play automatically; human observes |

### Human vs Human (`hvh`)

- Both sides controlled by human players
- Can be played locally or online (via SignalR relay)
- Bot difficulty and engine fields are unused

### Human vs Bot (`hvbot`)

- Human plays one color; bot plays the other
- `botSide` determines which color the bot controls
- `botDifficulty` sets the difficulty level
- `engineId` selects the engine adapter

### Bot vs Bot (`botvbot`)

- Both sides controlled by bots
- Human observes with optional pause and move delay controls
- Per-side configuration:
  - `botDifficultyWhite` / `botDifficultyBlack`
  - `engineIdWhite` / `engineIdBlack`

---

## 6. Bot Difficulty Levels

| Level | ID | Move Selection | Rule Compliance |
|-------|-----|---------------|----------------|
| **Easy** | `easy` | Random legal move | May violate rules (~25% chance if checking moves exist) |
| **Medium** | `medium` | Heuristic scoring (prefers captures, checks, central moves) | Follows rules; uses top-scoring moves with some randomness |
| **Hard** | `hard` | Minimax with alpha-beta pruning (depth 2) | Full variant awareness; deterministic |

### Violation Reporting (Bots)

- **Hard / Medium:** Always report valid violations
- **Easy:** May miss obvious violations probabilistically

---

## 7. Violation Detection

### Violation Types

| Type | Trigger | Variant Mode |
|------|---------|-------------|
| `missed_check` | Non-checking move played when checking moves exist | Classic / King Hunt |
| `gave_forbidden_check` | Checking move played when non-checking alternatives exist | Reverse |
| `missed_check_removal` | Piece removal didn't create required check | Classic / King Hunt (during penalty) |
| `gave_forbidden_check_removal` | Piece removal created forbidden check | Reverse (during penalty) |

### Detection Logic — Classic Modes

```
IF checking moves (regular or drop) exist:
  IF player played a non-checking move → VIOLATION (missed_check)
  IF player played a checking move → NO VIOLATION
ELSE:
  NO VIOLATION
```

### Detection Logic — Reverse Mode

```
IF checking moves exist:
  IF non-checking moves also exist:
    IF player gave check → VIOLATION (gave_forbidden_check)
    IF player didn't give check → NO VIOLATION
  ELSE (all legal moves give check):
    NO VIOLATION (exception)
ELSE:
  NO VIOLATION
```

### Violation Record

Each violation is captured as a `ViolationRecord` containing:

| Field | Description |
|-------|-------------|
| `violatingSide` | `'w'` or `'b'` |
| `moveIndex` | Position in moveHistory |
| `fenBeforeMove` | Board state before the move |
| `checkingMoves` | Regular checking moves that were available |
| `requiredMoves` | Moves the variant rules required |
| `actualMove` | Move that was actually played (absent for removal violations) |
| `reportable` | Whether the opponent can report this |
| `violationType` | One of the four violation types |
| `severe` | `true` when DCP active and ≥2 required moves exist |
| `requiredRemovalSquares` | For removal violations: squares whose removal satisfies the rule |
| `chosenRemovalSquare` | For removal violations: the square that was actually chosen |
| `checkingDropMoves` | Crazyhouse: drop moves that give check |
| `requiredDropMoves` | Crazyhouse: drop moves the player was required to choose from |

---

## 8. Penalty Mechanics

These mechanics apply only in **Penalty on Miss** game type.

### 8.1 Extra Turns

When the **Additional Move Penalty** is enabled, the opponent receives extra consecutive
turns after a violation.

#### State

| Field | Description |
|-------|-------------|
| `extraTurns.pendingExtraMovesWhite` | Extra moves White has remaining |
| `extraTurns.pendingExtraMovesBlack` | Extra moves Black has remaining |
| `inExtraTurn` | `true` if the current turn is an extra turn |

#### Mechanics

1. Violation occurs → `pendingExtraMoves[opponent] += additionalMoveCount`
2. After the opponent's normal move, `inExtraTurn` is set to `true`
3. `pendingExtraMoves[opponent]` is decremented
4. If still > 0, the same side moves again
5. When pending reaches 0, normal turn order resumes
6. **Extra turns must obey variant rules** (forced-check, etc.)

#### Violations During Extra Turns

If the opponent violates during an extra turn, the original violator's side receives
additional penalties. Tracked with `isAdditionalMove: true` in `MissedCheckEntry`.

---

### 8.2 Piece Removal

When the **Piece Removal Penalty** is enabled, the opponent selects piece(s) to remove
from the violator's side.

#### State

| Field | Description |
|-------|-------------|
| `pendingPieceRemoval.targetSide` | Whose pieces are removed (the violator) |
| `pendingPieceRemoval.chooserSide` | Who chooses (the opponent) |
| `pendingPieceRemoval.removableSquares` | Squares with removable pieces (excludes king) |
| `pendingPieceRemoval.remainingRemovals` | How many more pieces to remove |
| `pendingPieceRemoval.triggerMoveIndex` | Index of the violating move |

#### Removal Process

1. Violation occurs → `pendingPieceRemoval` is set; game pauses for opponent's choice
2. Opponent selects a square from `removableSquares`
3. Piece removed via `applyPieceRemoval(state, square)`
4. If `remainingRemovals > 1` → UI updates for the next selection
5. If `remainingRemovals == 1` → normal turn order resumes
6. If **no removable pieces exist** → immediate loss for the violator
   (`piece_removal_no_piece_loss`)

#### Restrictions

- **Kings can never be removed** — excluded when building removable squares
- If only king remains → immediate loss for the violator
- Removed pieces **do not** enter the opponent's reserve (not a Crazyhouse capture)

#### Variant Rules Apply to Removal

Even during piece removal, forced-check rules must be obeyed:

- **Classic mode:** If any removal would create a discovered check, the opponent must
  choose a check-creating removal. `selectBestPieceForRemoval()` enforces this.
- **Reverse mode:** If any non-check-creating removal exists, the opponent must avoid
  check-creating removals. If all removals create check, any is allowed.

#### Piece Removal Violation

If the opponent violates during their selection:

- Violation type: `missed_check_removal` or `gave_forbidden_check_removal`
- **Penalty on Miss:** Automatically penalized again (can cascade)
- **Report Incorrectness:** Opponent can report the removal violation

---

### 8.3 Time Reduction

When the **Time Reduction Penalty** is enabled (and the clock overlay is active),
seconds are subtracted from the violator's clock.

- Formula: `remaining = Math.max(0, currentMs - penaltyMs)`
- If remaining reaches 0 → immediate loss (`timeout_penalty`)
- Config: `penaltyConfig.timeReductionSeconds` (default: 60)

---

## 9. Game Termination

All possible game-ending conditions, listed in evaluation order:

### Decision Tree After a Move

```
After move applied:
├─ Atomic explosion killing opponent king?
│  └─ YES → atomic_king_explosion (winner: moving side)
├─ Checkmate?
│  └─ YES → checkmate (winner: moving side)
├─ King of the Hill — king on center square?
│  └─ YES → king_of_the_hill (winner: moving side)
├─ Stalemate?
│  └─ YES → stalemate (draw)
├─ Insufficient material?
│  └─ YES → insufficient-material (draw)
├─ Threefold repetition?
│  └─ YES → threefold-repetition (draw)
├─ Fifty-move rule?
│  └─ YES → fifty-move-rule (draw)
├─ King Hunt Given Check — reached target?
│  └─ YES → king_hunt_given_check_limit (winner: side that reached target)
├─ King Hunt Move Limit — reached ply limit?
│  ├─ Higher score → king_hunt_ply_limit (winner: higher scorer)
│  └─ Tied score → king_hunt_ply_limit_draw (draw)
└─ Game continues…
```

### Decision Tree After Violation + Penalty

```
After penalty applied:
├─ Did penalty create checkmate?
│  └─ YES → checkmate
├─ Did piece removal leave no removable pieces?
│  └─ YES → piece_removal_no_piece_loss
├─ Did time reduction reach 0?
│  └─ YES → timeout_penalty
└─ Game continues…
```

### Decision Tree During Report Incorrectness

```
During reporting phase:
├─ Severe violation (2+ required moves + DCP enabled)?
│  └─ YES → double_check_pressure_violation (immediate loss)
├─ Valid report on violation?
│  └─ YES → valid-report (violator loses)
├─ Invalid report, reaching threshold?
│  └─ YES → invalid-report-threshold (reporter loses)
└─ Game continues…
```

### Complete List of Game Result Reasons

| Reason | Type | Description |
|--------|------|-------------|
| `checkmate` | Win | Opponent has no legal moves and is in check |
| `king_of_the_hill` | Win | King reached a center square (d4/e4/d5/e5) |
| `atomic_king_explosion` | Win | Explosion destroyed opponent's king |
| `king_hunt_given_check_limit` | Win | Reached target number of checks |
| `king_hunt_ply_limit` | Win | Higher score at ply limit |
| `valid-report` | Win | Opponent correctly reported a violation |
| `invalid-report-threshold` | Win | Opponent made too many invalid reports |
| `double_check_pressure_violation` | Win | Severe violation with DCP enabled |
| `piece_removal_no_piece_loss` | Win | Violator has no removable pieces left |
| `timeout` | Win | Player's clock reached 0 naturally |
| `timeout_penalty` | Win | Violator's clock reached 0 from time reduction |
| `resignation` | Win | Player resigned |
| `stalemate` | Draw | Side to move has no legal moves, not in check |
| `insufficient-material` | Draw | K vs K, K+B vs K, K+N vs K |
| `threefold-repetition` | Draw | Same position repeated 3 times |
| `fifty-move-rule` | Draw | 50 full moves without pawn move or capture |
| `king_hunt_ply_limit_draw` | Draw | Tied score at ply limit |
| `draw` | Draw | Generic draw (simulation fallback) |

---

## 10. Configuration Reference

### MatchConfig (Frozen at Game Start)

```
MatchConfig
├── variantMode: VariantMode
├── gameType: GameType
├── overlays: OverlayConfig
│   ├── enableKingOfTheHill: boolean
│   ├── enableClock: boolean
│   ├── initialTimeMs: number
│   ├── incrementMs: number
│   ├── decrementMs: number
│   ├── enableDoubleCheckPressure: boolean
│   ├── enableCrazyhouse: boolean
│   ├── enableChess960: boolean
│   └── enableAtomic: boolean
├── reportConfig: ReportGameTypeConfig
│   └── invalidReportLossThreshold: number
├── penaltyConfig: PenaltyGameTypeConfig
│   ├── enableAdditionalMovePenalty: boolean
│   ├── additionalMoveCount: number
│   ├── enablePieceRemovalPenalty: boolean
│   ├── pieceRemovalCount: number
│   ├── enableTimeReductionPenalty: boolean
│   └── timeReductionSeconds: number
├── variantSpecific: VariantSpecificConfig
│   ├── kingHuntPlyLimit: number
│   └── kingHuntGivenCheckTarget: number
├── initialFen: string
└── chess960Index?: number
```

### GameSetupConfig (User Input)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | `GameMode` | `'hvh'` | Player mode |
| `botSide` | `Color` | `'b'` | Bot's color (hvbot) |
| `botDifficulty` | `BotLevel` | `'easy'` | Default difficulty |
| `botDifficultyWhite` | `BotLevel` | `'easy'` | White bot difficulty (botvbot) |
| `botDifficultyBlack` | `BotLevel` | `'easy'` | Black bot difficulty (botvbot) |
| `variantMode` | `VariantMode` | `'classic_blunzinger'` | Core variant rules |
| `gameType` | `GameType` | `'report_incorrectness'` | Violation resolution |
| `engineId` | `EngineId` | `'heuristic'` | Default engine |
| `engineIdWhite` | `EngineId` | `'heuristic'` | White engine (botvbot) |
| `engineIdBlack` | `EngineId` | `'heuristic'` | Black engine (botvbot) |
| `enableKingOfTheHill` | `boolean` | `false` | KOTH overlay |
| `enableClock` | `boolean` | `false` | Clock overlay |
| `initialTimeMs` | `number` | `300000` | Starting time (ms) |
| `incrementMs` | `number` | `0` | Per-move increment (ms) |
| `decrementMs` | `number` | `0` | Per-move decrement (ms) |
| `enableDoubleCheckPressure` | `boolean` | `false` | DCP overlay |
| `enableCrazyhouse` | `boolean` | `false` | Crazyhouse overlay |
| `enableChess960` | `boolean` | `false` | Chess960 overlay |
| `enableAtomic` | `boolean` | `false` | Atomic overlay |
| `invalidReportLossThreshold` | `number` | `2` | Invalid reports before loss |
| `enableAdditionalMovePenalty` | `boolean` | `false` | Extra turn penalty |
| `additionalMoveCount` | `number` | `1` | Extra turns per violation |
| `enablePieceRemovalPenalty` | `boolean` | `false` | Piece removal penalty |
| `pieceRemovalCount` | `number` | `1` | Pieces removed per violation |
| `enableTimeReductionPenalty` | `boolean` | `false` | Time reduction penalty |
| `timeReductionSeconds` | `number` | `60` | Seconds deducted per violation |
| `kingHuntPlyLimit` | `number` | `80` | Ply limit (King Hunt) |
| `kingHuntGivenCheckTarget` | `number` | `5` | Check target (King Hunt) |

---

## 11. Combination Matrix

### Variant Mode × Game Type

All 8 base combinations are valid:

| | Report Incorrectness | Penalty on Miss |
|---|---|---|
| **Classic Blunzinger** | Forced check + manual reporting | Forced check + auto penalties |
| **Reverse Blunzinger** | Avoid check + manual reporting | Avoid check + auto penalties |
| **King Hunt — Move Limit** | Forced check + scoring + reporting | Forced check + scoring + auto penalties |
| **King Hunt — Given Check Limit** | Forced check + scoring + reporting | Forced check + scoring + auto penalties |

### Overlay Compatibility

All overlays are independently composable with any variant mode × game type combination.
With 6 overlays, there are **2⁶ = 64** possible overlay combinations, each compatible
with all 8 base combinations, yielding **512 total configurations** (before player mode
and parameter variations).

| Overlay | Works with all variants? | Works with all game types? | Notes |
|---------|--------------------------|---------------------------|-------|
| King of the Hill | ✅ | ✅ | Additional win condition |
| Clock | ✅ | ✅ | Enables time reduction penalty |
| Double Check Pressure | ✅ | ✅ | Changes severity in Report mode |
| Crazyhouse | ✅ | ✅ | Drops participate in violation detection |
| Chess960 | ✅ | ✅ | Random starting position |
| Atomic | ✅ | ✅ | Explosion mechanic; custom check detection |

### Notable Multi-Overlay Combinations

| Combination | Interaction |
|-------------|------------|
| **Crazyhouse + Atomic** | Explosion victims enter reserves; drops are non-captures (no explosions) |
| **Chess960 + Atomic** | Randomized start + explosion mechanics; castling unaffected |
| **Chess960 + Crazyhouse** | Drops available from reserves in randomized positions |
| **KOTH + King Hunt** | Dual win conditions: center square OR check target/limit |
| **Clock + DCP + Report** | Severe violation = instant loss; timeout also possible |
| **Clock + Penalty + Time Reduction** | Violations cost time; multiple time penalties can stack |
| **All 6 overlays** | Fully supported; all interactions apply simultaneously |

---

## 12. Corner Cases & Edge Cases

### No Removable Pieces

- **Scenario:** Piece removal penalty triggered, but the violator has only their king
  remaining
- **Result:** Immediate loss via `piece_removal_no_piece_loss`
- **Applies to:** Both normal moves and extra turns

### All Moves Give Check (Reverse Mode)

- **Scenario:** In Reverse Blunzinger, every legal move gives check
- **Result:** Any move is allowed; no violation is possible on that turn
- **Scoring:** The move still counts as a check for King Hunt scoring purposes

### Violation During Extra Turn

- **Scenario:** The opponent (who received extra turns) violates during one of those
  extra turns
- **Result:** Penalties cascade — the original violator's side receives additional
  penalties
- **Tracking:** `isAdditionalMove: true` in `MissedCheckEntry`

### Timeout During Piece Removal

- **Scenario:** The opponent is choosing which piece to remove while the clock is
  running
- **Result:** The clock runs for the choosing side (the opponent). If the chooser's
  time reaches 0, the **chooser** loses — not the original violator

### Crazyhouse + Atomic Explosion

- **Scenario:** A capture triggers an explosion that destroys multiple adjacent pieces
- **Result:** All destroyed pieces go to the capturing side's reserve
- **Details:** Both the directly captured piece and explosion victims are tracked
  separately

### Chess960 Castling as Violation Source

- **Scenario:** Checking moves include a Chess960 castling move
- **Result:** The castling move is treated as checking/non-checking for violation
  purposes, using the after-move FEN to determine check status

### King of the Hill + Checkmate Simultaneously

- **Scenario:** A move both gives checkmate and moves the king to a center square
- **Result:** Checkmate takes precedence in the evaluation order
- **Evaluation order:** Atomic explosion → Checkmate → KOTH → other terminal conditions

### Atomic + Reverse Blunzinger

- **Scenario:** Detecting required moves when Atomic restricts king captures
- **Result:** King captures are excluded from legal move counts (kings can never capture
  in Atomic); remaining moves are evaluated for checking/non-checking

### Atomic Checkmate/Stalemate Detection

- **Scenario:** chess.js reports legal moves exist, but all are illegal under Atomic
  rules
- **Result:** Post-chess.js Atomic filter may reduce legal moves to zero, resulting in
  checkmate or stalemate that chess.js alone wouldn't detect
- **Crazyhouse interaction:** Atomic stalemate detection also considers Crazyhouse drops
  as potential escape routes

### Double Check Pressure + Piece Removal

- **Scenario:** During piece removal, 2+ check-creating removals exist
- **Result:** Severity flag is set; in Report Incorrectness mode, choosing a non-check-
  creating removal with DCP enabled may cause immediate loss

### Clock Reaches Zero During Penalty Application

- **Scenario:** Time reduction penalty brings the violator's clock to exactly 0
- **Result:** Immediate loss (`timeout_penalty`), distinct from natural timeout
  (`timeout`)

### King Hunt + Standard Checkmate

- **Scenario:** Checkmate occurs before the ply/check limit is reached
- **Result:** Standard checkmate result takes precedence over King Hunt scoring. The
  game ends immediately with `checkmate`, regardless of current scores

### Empty Reserve Drop Attempt (Crazyhouse)

- **Scenario:** Player has no pieces in their reserve
- **Result:** No drop moves are generated; only regular moves are available. If no
  regular moves exist either, standard checkmate/stalemate rules apply

### Multi-Piece Removal Cascading

- **Scenario:** `pieceRemovalCount` is set to 3, but the violator has only 2 non-king
  pieces
- **Result:** After removing 2 pieces, only the king remains → immediate loss
  (`piece_removal_no_piece_loss`)

### Penalty on Move That Ends in Checkmate

- **Scenario:** A player violates the forced-check rule, but their move happens to
  deliver checkmate
- **Result:** No penalties are applied. The game ends with `checkmate`.

### Report Window Timing

- **Scenario:** A violation occurs, and the opponent wants to report it
- **Result:** The opponent can only report **before** making their next move. Once they
  move, the violation is no longer reportable.

### Penalty with No Enabled Penalties

- **Scenario:** Penalty on Miss game type selected but all three penalty toggles are
  disabled
- **Result:** Violations are detected and recorded, but no actual penalty is applied.
  The game continues normally. (This is a valid but degenerate configuration.)

---

## 13. Default Configuration

The default game setup uses the most beginner-friendly settings:

```
Variant Mode:       Classic Blunzinger (forced check)
Game Type:          Report Incorrectness (manual reporting)
Player Mode:        Human vs Human
Clock:              Disabled
King of the Hill:   Disabled
Double Check Press: Disabled
Crazyhouse:         Disabled
Chess960:           Disabled
Atomic:             Disabled

Report threshold:   2 invalid reports → loss
Clock time:         5 minutes (if enabled)
Clock increment:    0
Clock decrement:    0

Penalty settings (if Penalty on Miss is selected):
  Additional moves:   Disabled (1 extra turn per violation if enabled)
  Piece removal:      Disabled (1 piece per violation if enabled)
  Time reduction:     Disabled (60 seconds per violation if enabled)

King Hunt settings (if a King Hunt variant is selected):
  Ply limit:          80 (40 full moves)
  Given check target: 5
```

---

*This document is generated from the source code in `src/core/blunziger/types.ts`,
`src/core/blunziger/engine.ts`, `src/components/RulesPage.tsx`, and
`src/components/RulesPanel.tsx`. For the latest rules, always refer to the source code.*
