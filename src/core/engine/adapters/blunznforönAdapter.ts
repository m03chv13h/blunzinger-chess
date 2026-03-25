/**
 * Blunznforön engine adapter — Fairy-Stockfish integration.
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
import { heuristicAnalysis } from './shared';

const INFO: EngineInfo = {
  id: 'blunznforön',
  name: 'Blunznforön',
  description:
    'Fairy-Stockfish variant engine — will provide deep multi-PV search with native variant support. Currently awaiting WASM integration.',
  availability: 'coming_soon',
  supportsEvaluation: true,
  supportsBotPlay: true,
  supportsVariantAwareness: true,
};

/**
 * Whether the real Fairy-Stockfish WASM runtime is loaded.
 * When false the adapter falls back to heuristic evaluation.
 */
let wasmLoaded = false;

export function createBlunznforönAdapter(): VariantEngineAdapter {
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
      // but labelled as Blunznforön so the adapter contract is exercised).
      return heuristicAnalysis(options.fen);
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
