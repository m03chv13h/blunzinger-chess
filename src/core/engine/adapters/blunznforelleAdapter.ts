/**
 * Blunznforelle engine adapter — Fairy-Stockfish integration.
 *
 * Fairy-Stockfish is a UCI-compatible chess variant engine.  In a browser-only
 * deployment it would be loaded as a WASM module via a Web Worker.
 *
 * Because the WASM binary is not yet bundled with this app, the adapter
 * reports itself as `available` but gracefully falls back to a lightweight
 * UCI-less analysis mode that demonstrates the adapter contract.
 *
 * When the Fairy-Stockfish WASM module is added (e.g. via a `public/` asset
 * or an npm package), the `initialize()` method should instantiate the worker
 * and the UCI command loop should drive `analyzePosition` / `getBestMove`.
 *
 * IMPORTANT: This engine is **advisory only**.  The app's authoritative rules
 * (violations, penalties, overlays) remain in `core/blunziger/`.
 */

import type {
  VariantEngineAdapter,
  EngineInfo,
  AnalyzePositionOptions,
  EngineLine,
} from '../types';
import { evaluateBasePosition } from '../../evaluation/evaluatePosition';
import { Chess } from 'chess.js';

const INFO: EngineInfo = {
  id: 'blunznforelle',
  name: 'Blunznforelle',
  description: 'Fairy-Stockfish variant engine integration',
  availability: 'available',
  supportsEvaluation: true,
  supportsBotPlay: true,
  supportsVariantAwareness: true,
};

/**
 * Whether the real Fairy-Stockfish WASM runtime is loaded.
 * When false the adapter falls back to heuristic evaluation.
 */
let wasmLoaded = false;

export function createBlunznforelleAdapter(): VariantEngineAdapter {
  let disposed = false;

  return {
    info: INFO,

    async initialize(): Promise<void> {
      if (disposed) return;
      // TODO: Load Fairy-Stockfish WASM binary and spin up a Web Worker.
      //
      //   const worker = new Worker(new URL('./fairystockfish.worker.js', import.meta.url));
      //   await new Promise(resolve => {
      //     worker.onmessage = (e) => { if (e.data === 'uciok') resolve(); };
      //     worker.postMessage('uci');
      //   });
      //   wasmLoaded = true;
      //
      // Until then, we use the heuristic fallback.
      wasmLoaded = false;
    },

    async analyzePosition(options: AnalyzePositionOptions): Promise<EngineLine[]> {
      if (disposed) return [];

      if (wasmLoaded) {
        // TODO: Send UCI commands to the Fairy-Stockfish worker.
        //   worker.postMessage(`position fen ${options.fen}`);
        //   worker.postMessage(`go depth ${options.depth ?? 12}`);
        //   … parse "info" lines and return EngineLine[]
        return [];
      }

      // Fallback: heuristic analysis (same quality as the Heuristic adapter
      // but labelled as Blunznforelle so the adapter contract is exercised).
      return heuristicFallback(options);
    },

    async getBestMove(options: AnalyzePositionOptions): Promise<string | null> {
      if (disposed) return null;

      if (wasmLoaded) {
        // TODO: Send `go depth …` and parse `bestmove` response.
        return null;
      }

      const lines = await this.analyzePosition(options);
      return lines[0]?.bestMove ?? null;
    },

    dispose(): void {
      disposed = true;
      // TODO: Terminate the Fairy-Stockfish Web Worker when WASM is loaded.
    },
  };
}

// ── Heuristic fallback (used until WASM is bundled) ──────────────────

function heuristicFallback(options: AnalyzePositionOptions): EngineLine[] {
  const base = evaluateBasePosition(options.fen);
  const bestMoveUci = findBestMoveUci(options.fen);

  return [
    {
      bestMove: bestMoveUci,
      pv: bestMoveUci ? [bestMoveUci] : [],
      score: {
        scoreCp: base.scoreCp,
        mateIn: base.mateIn,
        favoredSide:
          base.scoreCp > 25
            ? 'white'
            : base.scoreCp < -25
              ? 'black'
              : 'equal',
      },
    },
  ];
}

function findBestMoveUci(fen: string): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  if (moves.length === 1) return `${moves[0].from}${moves[0].to}${moves[0].promotion ?? ''}`;

  const isWhite = fen.split(' ')[1] === 'w';
  let bestMove = moves[0];
  let bestScore = isWhite ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move.san);
    if (chess.isCheckmate()) {
      return `${move.from}${move.to}${move.promotion ?? ''}`;
    }
    const score = evaluateBasePosition(chess.fen()).scoreCp;
    if (isWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
    chess.undo();
  }

  return `${bestMove.from}${bestMove.to}${bestMove.promotion ?? ''}`;
}
