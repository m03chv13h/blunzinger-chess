/**
 * Type definitions for ffish.js — the Fairy-Stockfish WASM board library.
 *
 * Based on the official ffish.js API. These types describe the subset of
 * Fairy-Stockfish exposed through the Emscripten/WASM build.
 *
 * To update the WASM:
 *   1. Replace public/ffish.js and public/ffish.wasm with the new build.
 *   2. Update FFISH_WASM_VERSION in blunznfishAdapter.ts.
 *   3. Update these type definitions if the API changed.
 *   4. Run `npm test` to verify compatibility.
 */

export declare function Module(opts?: ModuleOptions): Promise<FairyStockfish>;
export default Module;

export interface ModuleOptions {
  arguments?: string[];
  buffer?: ArrayBuffer | SharedArrayBuffer;
  wasmMemory?: WebAssembly.Memory;
  locateFile?: (file: string, prefix: string) => string;
  logReadFiles?: boolean;
  printWithColors?: boolean;
  onAbort?: (status: string | number) => void;
  onRuntimeInitialized?: (loadedModule: FairyStockfish) => void;
  noExitRuntime?: boolean;
  noInitialRun?: boolean;
  preInit?: () => void | (() => void)[];
  preRun?: () => void | (() => void)[];
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  mainScriptUrlOrBlob?: string;
}

export interface FairyStockfish {
  Board: FfishBoardConstructor;
  Game: FfishGame;
  Notation: typeof Notation;
  Termination: typeof Termination;
  info(): string;
  setOption<T>(name: string, value: T): void;
  setOptionInt(name: string, value: number): void;
  setOptionBool(name: string, value: boolean): void;
  readGamePGN(pgn: string): FfishGame;
  variants(): string;
  loadVariantConfig(variantInitContent: string): void;
  capturesToHand(uciVariant: string): boolean;
  startingFen(uciVariant: string): string;
  validateFen(fen: string, uciVariant?: string, chess960?: boolean): number;
}

export interface FfishBoardConstructor {
  new (uciVariant?: string, fen?: string, is960?: boolean): FfishBoard;
}

export interface FfishBoard {
  delete(): void;
  legalMoves(): string;
  legalMovesSan(): string;
  numberLegalMoves(): number;
  push(uciMove: string): boolean;
  pushSan(sanMove: string, notation?: Notation): boolean;
  pop(): void;
  reset(): void;
  is960(): boolean;
  fen(showPromoted?: boolean, countStarted?: number): string;
  setFen(fen: string): void;
  sanMove(uciMove: string, notation?: Notation): string;
  variationSan(uciMoves: string, notation?: Notation, moveNumbers?: boolean): string;
  turn(): boolean;
  fullmoveNumber(): number;
  halfmoveClock(): number;
  gamePly(): number;
  hasInsufficientMaterial(turn: boolean): boolean;
  isInsufficientMaterial(): boolean;
  isGameOver(claimDraw?: boolean): boolean;
  result(claimDraw?: boolean): string;
  checkedPieces(): string;
  isCheck(): boolean;
  isBikjang(): boolean;
  isCapture(uciMove: string): boolean;
  moveStack(): string;
  pushMoves(uciMoves: string): void;
  pushSanMoves(sanMoves: string, notation?: Notation): void;
  pocket(color: boolean): string;
  toString(): string;
  toVerboseString(): string;
  variant(): string;
}

export interface FfishGame {
  delete(): void;
  headerKeys(): string;
  headers(item: string): string;
  mainlineMoves(): string;
}

export declare enum Notation {
  DEFAULT,
  SAN,
  LAN,
  SHOGI_HOSKING,
  SHOGI_HODGES,
  SHOGI_HODGES_NUMBER,
  JANGGI,
  XIANGQI_WXF,
  THAI_SAN,
  THAI_LAN,
}

export declare enum Termination {
  ONGOING,
  CHECKMATE,
  STALEMATE,
  INSUFFICIENT_MATERIAL,
  N_MOVE_RULE,
  N_FOLD_REPETITION,
  VARIANT_END,
}
