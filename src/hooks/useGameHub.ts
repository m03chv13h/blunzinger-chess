/**
 * useGameHub – React hook for the SignalR real-time game connection.
 *
 * Manages a SignalR connection to `/hubs/game`, authenticating with the
 * stored JWT.  Exposes methods that mirror the GameHub server methods
 * and callbacks for server-pushed events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import type { HubConnection } from '@microsoft/signalr';
import { getToken } from '../services/apiClient';

// ── Server → Client event payloads ──────────────────────────────────

export interface PlayerJoinedEvent {
  userId: string;
  roomCode: string;
  status: string;
  gameState: string | null;
}

export interface GameStateUpdatedEvent {
  gameState: string;
  move?: string;
}

export interface MoveRejectedEvent {
  error: string;
}

export interface GameOverEvent {
  reason: string;
  detail?: string;
  resigningSide?: string;
}

export interface DrawOfferedEvent {
  offeredBy: string;
}

export interface MatchFoundEvent {
  roomId: string;
  code: string;
}

export interface PlayerLeftEvent {
  userId: string;
}

// ── Client → Server DTOs ────────────────────────────────────────────

export interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface DropMove {
  pieceType: string;
  square: string;
}

// ── Hook callbacks ──────────────────────────────────────────────────

export interface GameHubCallbacks {
  onPlayerJoined?: (event: PlayerJoinedEvent) => void;
  onPlayerLeft?: (event: PlayerLeftEvent) => void;
  onOpponentDisconnected?: (event: PlayerLeftEvent) => void;
  onGameStateUpdated?: (event: GameStateUpdatedEvent) => void;
  onMoveRejected?: (event: MoveRejectedEvent) => void;
  onGameOver?: (event: GameOverEvent) => void;
  onDrawOffered?: (event: DrawOfferedEvent) => void;
  onMatchFound?: (event: MatchFoundEvent) => void;
  onError?: (message: string) => void;
}

// ── Hook return ─────────────────────────────────────────────────────

export interface UseGameHub {
  /** Current connection state. */
  connected: boolean;
  /** Connect to the hub (idempotent). */
  connect: () => Promise<void>;
  /** Disconnect from the hub. */
  disconnect: () => Promise<void>;
  /** Join a multiplayer room. */
  joinRoom: (roomCode: string) => Promise<void>;
  /** Leave the current room. */
  leaveRoom: () => Promise<void>;
  /** Send a standard chess move. */
  makeMove: (roomCode: string, move: ChessMove) => Promise<void>;
  /** Send a Crazyhouse drop move. */
  makeDropMove: (roomCode: string, drop: DropMove) => Promise<void>;
  /** Report a violation. */
  reportViolation: (roomCode: string) => Promise<void>;
  /** Select a piece for removal. */
  selectPieceForRemoval: (roomCode: string, square: string) => Promise<void>;
  /** Resign the game. */
  resignGame: (roomCode: string) => Promise<void>;
  /** Offer a draw. */
  offerDraw: (roomCode: string) => Promise<void>;
  /** Accept a draw. */
  acceptDraw: (roomCode: string) => Promise<void>;
}

/** Hub URL – resolved relative to the API base. */
const HUB_URL = (import.meta.env.VITE_API_BASE_URL ?? '') + '/hubs/game';

export function useGameHub(callbacks: GameHubCallbacks = {}): UseGameHub {
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<HubConnection | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref in sync without accessing during render.
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // Build the HubConnection once.
  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getToken() ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    // Register event handlers – delegate to latest callbacks via ref.
    connection.on('PlayerJoined', (e: PlayerJoinedEvent) => callbacksRef.current.onPlayerJoined?.(e));
    connection.on('PlayerLeft', (e: PlayerLeftEvent) => callbacksRef.current.onPlayerLeft?.(e));
    connection.on('OpponentDisconnected', (e: PlayerLeftEvent) => callbacksRef.current.onOpponentDisconnected?.(e));
    connection.on('GameStateUpdated', (e: GameStateUpdatedEvent) => callbacksRef.current.onGameStateUpdated?.(e));
    connection.on('MoveRejected', (e: MoveRejectedEvent) => callbacksRef.current.onMoveRejected?.(e));
    connection.on('GameOver', (e: GameOverEvent) => callbacksRef.current.onGameOver?.(e));
    connection.on('DrawOffered', (e: DrawOfferedEvent) => callbacksRef.current.onDrawOffered?.(e));
    connection.on('MatchFound', (e: MatchFoundEvent) => callbacksRef.current.onMatchFound?.(e));
    connection.on('Error', (msg: string) => callbacksRef.current.onError?.(msg));

    connection.onclose(() => setConnected(false));
    connection.onreconnected(() => setConnected(true));
    connection.onreconnecting(() => setConnected(false));

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, []);

  const connect = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state === HubConnectionState.Connected) return;
    await conn.start();
    setConnected(true);
  }, []);

  const disconnect = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn) return;
    await conn.stop();
    setConnected(false);
  }, []);

  // ── Hub method wrappers ────────────────────────────────────────────

  const invoke = useCallback(async (method: string, ...args: unknown[]) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== HubConnectionState.Connected) {
      throw new Error('Not connected to game hub');
    }
    await conn.invoke(method, ...args);
  }, []);

  const joinRoom = useCallback((roomCode: string) => invoke('JoinRoom', roomCode), [invoke]);
  const leaveRoom = useCallback(() => invoke('LeaveRoom'), [invoke]);
  const makeMove = useCallback((roomCode: string, move: ChessMove) => invoke('MakeMove', roomCode, move), [invoke]);
  const makeDropMove = useCallback((roomCode: string, drop: DropMove) => invoke('MakeDropMove', roomCode, drop), [invoke]);
  const reportViolation = useCallback((roomCode: string) => invoke('ReportViolation', roomCode), [invoke]);
  const selectPieceForRemoval = useCallback((roomCode: string, square: string) => invoke('SelectPieceForRemoval', roomCode, square), [invoke]);
  const resignGame = useCallback((roomCode: string) => invoke('ResignGame', roomCode), [invoke]);
  const offerDraw = useCallback((roomCode: string) => invoke('OfferDraw', roomCode), [invoke]);
  const acceptDraw = useCallback((roomCode: string) => invoke('AcceptDraw', roomCode), [invoke]);

  return {
    connected,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    makeMove,
    makeDropMove,
    reportViolation,
    selectPieceForRemoval,
    resignGame,
    offerDraw,
    acceptDraw,
  };
}
