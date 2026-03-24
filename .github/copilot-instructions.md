# Copilot Instructions for Blunziger Chess

## Project Overview

Blunziger Chess is a browser-based chess variant application built with React and TypeScript. It layers custom variant rules (forced checks, reverse checks, King Hunt scoring), game types (report-based or penalty-based), and overlays (King of the Hill, clock, Double Check Pressure) on top of standard chess via chess.js.

## Tech Stack

- **React 19** with functional components and hooks (no class components)
- **TypeScript 5.9** in strict mode (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- **Vite** for bundling and dev server
- **Vitest** with jsdom environment for testing
- **chess.js** for move generation and validation
- **Plain CSS** with co-located files (no CSS modules, Tailwind, or CSS-in-JS)
- **ESLint 9** flat config with typescript-eslint, react-hooks, and react-refresh plugins

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Type-check with `tsc -b` then bundle with Vite
- `npm run lint` — Run ESLint
- `npm test` — Run all tests with Vitest
- `npm run test:watch` — Run tests in watch mode

## Architecture

```
src/
├── core/blunziger/    # Pure TypeScript game logic — NO React or DOM dependencies
├── core/evaluation/   # Pure TypeScript evaluation system — variant-aware
├── core/engine/       # External engine adapter abstraction and registry
├── core/gameRecord.ts # Game history/replay record type
├── bot/               # Bot move selection — depends only on core/ and chess.js
├── hooks/             # React hooks bridging core logic and UI state
├── components/        # React UI components with co-located CSS
└── __tests__/         # Vitest test files
```

### Separation of Concerns

- **`core/blunziger/`** contains all game rules as pure, deterministic, stateless functions. It has zero React or browser dependencies and is designed for future server-side reuse. Never add React or DOM imports here.
- **`core/evaluation/`** contains pure evaluation functions. Combines base chess evaluation with variant-aware adjustments.
- **`bot/`** depends only on `core/` and `chess.js`.
- **`hooks/`** bridges core logic to React state (game state, clocks, evaluation memoization, review navigation).
- **`components/`** are React UI; they interact with core logic only through hooks.

## Code Conventions

- Use **discriminated unions** for state variants (e.g., `AppScreen` uses `{ type: 'quick-start' } | { type: 'playing'; config: GameSetupConfig }`).
- Use **literal union types** for enums (e.g., `type VariantMode = 'classic_blunzinger' | 'reverse_blunzinger' | ...`).
- Use **`type` imports** for type-only imports (`import type { GameState } from ...`).
- Configuration objects (`MatchConfig`) are **immutable once a game starts**.
- Prefer `useCallback` for event handler props passed to child components.
- Export named functions from components (e.g., `export function Chessboard(...)`).
- Each component has a co-located `.css` file (e.g., `Chessboard.tsx` + `Chessboard.css`).

## Testing Conventions

- Tests live in `src/__tests__/` and use Vitest (`describe`, `it`, `expect`).
- Vitest globals are enabled — no need to import `describe`/`it`/`expect` but explicit imports from `vitest` are also used.
- Use factory helpers for test data (e.g., `makeConfig()`, `makeState()` with partial overrides).
- Test game logic with FEN-based position setups.
- UI tests use `@testing-library/react` with `render`/`screen`/`fireEvent`.
- Test files follow the pattern `src/__tests__/<feature>.test.ts` or `.test.tsx` for component tests.

## Licensing

Only use **MIT, BSD, or Apache-licensed** dependencies. The custom chessboard component intentionally avoids Chessground (GPL) to keep the project under a permissive license. Do not introduce GPL-licensed dependencies.
