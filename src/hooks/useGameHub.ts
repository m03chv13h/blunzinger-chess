/**
 * useGameHub – React hook for real-time game WebSocket connection.
 *
 * Manages a WebSocket connection to `/hubs/game`, authenticating with the
 * stored JWT via query param.  Exposes methods that mirror the GameHub
 * server methods and callbacks for server-pushed events.
 *
 * Uses native WebSocket (compatible with Cloudflare Durable Objects).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getToken, API_BASE } from '../services/apiClient';

// ── Server → Client event payloads ──────────────────────────────────

export interface PlayerJoinedEvent {
  userId: string;
  displayName?: string;
  roomCode: string;
  status: string;
  gameState: string | null;
  matchConfig?: string;
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
  disconnectedSide?: string;
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

export interface OpponentDisconnectedEvent {
  userId: string;
  timeoutSeconds: number;
}

export interface OpponentReconnectedEvent {
  userId: string;
}

export interface OpponentMovedEvent {
  from: string;
  to: string;
  promotion?: string;
}

export interface OpponentDropMoveEvent {
  pieceType: string;
  square: string;
}

export interface OpponentPieceRemovalEvent {
  square: string;
}

export interface RoomExpiredEvent {
  roomCode: string;
  reason: string;
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
  onOpponentDisconnected?: (event: OpponentDisconnectedEvent) => void;
  onOpponentReconnected?: (event: OpponentReconnectedEvent) => void;
  onGameStateUpdated?: (event: GameStateUpdatedEvent) => void;
  onMoveRejected?: (event: MoveRejectedEvent) => void;
  onGameOver?: (event: GameOverEvent) => void;
  onDrawOffered?: (event: DrawOfferedEvent) => void;
  onDrawDeclined?: () => void;
  onMatchFound?: (event: MatchFoundEvent) => void;
  onOpponentMoved?: (event: OpponentMovedEvent) => void;
  onOpponentDropMove?: (event: OpponentDropMoveEvent) => void;
  onOpponentReported?: () => void;
  onOpponentPieceRemoval?: (event: OpponentPieceRemovalEvent) => void;
  onRoomExpired?: (event: RoomExpiredEvent) => void;
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
  /** Decline a draw. */
  declineDraw: (roomCode: string) => Promise<void>;
  /** Notify the server the game has ended (client-side detection). */
  endGame: (roomCode: string) => Promise<void>;
  /** Relay a move to the opponent (client-side engine). */
  sendMove: (roomCode: string, from: string, to: string, promotion?: string) => Promise<void>;
  /** Relay a drop move to the opponent (client-side engine). */
  sendDropMove: (roomCode: string, pieceType: string, square: string) => Promise<void>;
  /** Relay a violation report to the opponent. */
  sendReport: (roomCode: string) => Promise<void>;
  /** Relay a piece removal selection to the opponent. */
  sendPieceRemoval: (roomCode: string, square: string) => Promise<void>;
}

/** Hub URL – resolved relative to the API base (WebSocket). */
function getWsUrl(roomCode?: string): string {
  const base = API_BASE || window.location.origin;
  const protocol = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  const params = new URLSearchParams();
  const token = getToken();
  if (token) params.set('access_token', token);
  if (roomCode) params.set('roomCode', roomCode);
  return `${protocol}://${host}/hubs/game?${params.toString()}`;
}

export function useGameHub(callbacks: GameHubCallbacks = {}): UseGameHub {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef(callbacks);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);

  // Keep callbacks ref in sync without accessing during render.
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as { type: string; data?: unknown };
      const cb = callbacksRef.current;

      switch (msg.type) {
        case 'PlayerJoined': cb.onPlayerJoined?.(msg.data as PlayerJoinedEvent); break;
        case 'PlayerLeft': cb.onPlayerLeft?.(msg.data as PlayerLeftEvent); break;
        case 'OpponentDisconnected': cb.onOpponentDisconnected?.(msg.data as OpponentDisconnectedEvent); break;
        case 'OpponentReconnected': cb.onOpponentReconnected?.(msg.data as OpponentReconnectedEvent); break;
        case 'GameStateUpdated': cb.onGameStateUpdated?.(msg.data as GameStateUpdatedEvent); break;
        case 'MoveRejected': cb.onMoveRejected?.(msg.data as MoveRejectedEvent); break;
        case 'GameOver': cb.onGameOver?.(msg.data as GameOverEvent); break;
        case 'DrawOffered': cb.onDrawOffered?.(msg.data as DrawOfferedEvent); break;
        case 'DrawDeclined': cb.onDrawDeclined?.(); break;
        case 'MatchFound': cb.onMatchFound?.(msg.data as MatchFoundEvent); break;
        case 'OpponentMoved': cb.onOpponentMoved?.(msg.data as OpponentMovedEvent); break;
        case 'OpponentDropMove': cb.onOpponentDropMove?.(msg.data as OpponentDropMoveEvent); break;
        case 'OpponentReported': cb.onOpponentReported?.(); break;
        case 'OpponentPieceRemoval': cb.onOpponentPieceRemoval?.(msg.data as OpponentPieceRemovalEvent); break;
        case 'RoomExpired': cb.onRoomExpired?.(msg.data as RoomExpiredEvent); break;
        case 'Error': cb.onError?.(typeof msg.data === 'string' ? msg.data : String(msg.data)); break;
      }
    } catch {
      // Invalid JSON — ignore
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!intentionalCloseRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        connectInternal();
      }
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectInternal = useCallback((roomCode?: string) => {
    const token = getToken();
    if (!token) return;

    const url = getWsUrl(roomCode || currentRoomRef.current || undefined);
    const ws = new WebSocket(url);

    ws.onopen = () => setConnected(true);
    ws.onmessage = handleMessage;
    ws.onclose = () => {
      setConnected(false);
      if (!intentionalCloseRef.current) {
        scheduleReconnect();
      }
    };
    ws.onerror = () => {
      setConnected(false);
    };

    wsRef.current = ws;
  }, [handleMessage, scheduleReconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    intentionalCloseRef.current = false;
    connectInternal();
  }, [connectInternal]);

  const disconnect = useCallback(async () => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  // ── Send helper ────────────────────────────────────────────────────

  const send = useCallback((type: string, data?: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to game hub');
    }
    ws.send(JSON.stringify({ type, data }));
  }, []);

  // ── Hub method wrappers ────────────────────────────────────────────

  const joinRoom = useCallback(async (roomCode: string) => {
    currentRoomRef.current = roomCode;
    // Reconnect with roomCode so the Worker routes to the correct Durable Object
    if (wsRef.current) {
      wsRef.current.close();
    }
    connectInternal(roomCode);
  }, [connectInternal]);
  const leaveRoom = useCallback(async () => send('LeaveRoom'), [send]);
  const makeMove = useCallback(async (roomCode: string, move: ChessMove) => send('MakeMove', { roomCode, move }), [send]);
  const makeDropMove = useCallback(async (roomCode: string, drop: DropMove) => send('MakeDropMove', { roomCode, drop }), [send]);
  const reportViolation = useCallback(async (roomCode: string) => send('ReportViolation', { roomCode }), [send]);
  const selectPieceForRemoval = useCallback(async (roomCode: string, square: string) => send('SelectPieceForRemoval', { roomCode, square }), [send]);
  const resignGame = useCallback(async (roomCode: string) => send('ResignGame', roomCode), [send]);
  const offerDraw = useCallback(async (roomCode: string) => send('OfferDraw', { roomCode }), [send]);
  const acceptDraw = useCallback(async (roomCode: string) => send('AcceptDraw', { roomCode }), [send]);
  const declineDraw = useCallback(async (roomCode: string) => send('DeclineDraw', { roomCode }), [send]);
  const endGame = useCallback(async (roomCode: string) => send('EndGame', roomCode), [send]);

  // ── Client-side relay methods ──────────────────────────────────────
  const sendMove = useCallback(
    async (roomCode: string, from: string, to: string, promotion?: string) =>
      send('SendMove', { roomCode, from, to, promotion: promotion ?? null }),
    [send],
  );
  const sendDropMove = useCallback(
    async (roomCode: string, pieceType: string, square: string) =>
      send('SendDropMove', { roomCode, pieceType, square }),
    [send],
  );
  const sendReport = useCallback(async (roomCode: string) => send('SendReport', { roomCode }), [send]);
  const sendPieceRemoval = useCallback(
    async (roomCode: string, square: string) => send('SendPieceRemoval', { roomCode, square }),
    [send],
  );

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
    declineDraw,
    endGame,
    sendMove,
    sendDropMove,
    sendReport,
    sendPieceRemoval,
  };
}
