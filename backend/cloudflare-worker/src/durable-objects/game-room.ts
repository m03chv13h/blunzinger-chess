import type { Env } from '../types.js';
import { RoomStatus } from '../types.js';

/** Seconds before a disconnected player forfeits. */
const DISCONNECT_TIMEOUT_SECONDS = 20;

interface ConnectionMeta {
  userId: string;
  roomCode: string;
}

/**
 * Durable Object for managing a single multiplayer game room.
 * Handles WebSocket connections, move relay, disconnect timeouts.
 */
export class GameRoom implements DurableObject {
  private connections = new Map<WebSocket, ConnectionMeta>();
  private disconnectTimers = new Map<string, number>(); // userId → alarm timestamp
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/websocket') {
      return this.handleWebSocket(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private handleWebSocket(request: Request): Response {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const roomCode = url.searchParams.get('roomCode');

    if (!userId || !roomCode) {
      return new Response('Missing userId or roomCode', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);

    const meta: ConnectionMeta = { userId, roomCode };
    this.connections.set(server, meta);

    // Cancel any pending disconnect timer
    if (this.disconnectTimers.has(userId)) {
      this.disconnectTimers.delete(userId);
      // Notify others of reconnection
      this.broadcast(server, JSON.stringify({
        type: 'OpponentReconnected',
        data: { userId },
      }));
    }

    // Notify room of join
    this.broadcast(server, JSON.stringify({
      type: 'PlayerJoined',
      data: { userId, roomCode },
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const meta = this.connections.get(ws);
    if (!meta) return;

    const msg = typeof message === 'string' ? message : new TextDecoder().decode(message);

    try {
      const parsed = JSON.parse(msg) as { type: string; data?: unknown };

      switch (parsed.type) {
        case 'SendMove':
        case 'SendDropMove':
        case 'SendReport':
        case 'SendPieceRemoval':
          // Update last activity
          await this.env.DB.prepare(
            'UPDATE MultiplayerRooms SET LastActivityAt = datetime(\'now\') WHERE Code = ?'
          ).bind(meta.roomCode).run();
          // Relay to others
          this.broadcast(ws, msg);
          break;

        case 'ResignGame':
          await this.env.DB.prepare(
            'UPDATE MultiplayerRooms SET Status = ? WHERE Code = ?'
          ).bind(RoomStatus.Finished, meta.roomCode).run();
          this.broadcastAll(JSON.stringify({
            type: 'GameOver',
            data: { reason: 'resignation', resigningSide: parsed.data },
          }));
          break;

        case 'OfferDraw':
          this.broadcast(ws, JSON.stringify({
            type: 'DrawOffered',
            data: { offeredBy: meta.userId },
          }));
          break;

        case 'DeclineDraw':
          this.broadcast(ws, JSON.stringify({ type: 'DrawDeclined' }));
          break;

        case 'AcceptDraw':
          await this.env.DB.prepare(
            'UPDATE MultiplayerRooms SET Status = ? WHERE Code = ?'
          ).bind(RoomStatus.Finished, meta.roomCode).run();
          this.broadcastAll(JSON.stringify({
            type: 'GameOver',
            data: { reason: 'draw', detail: 'Draw by agreement' },
          }));
          break;

        case 'EndGame':
          await this.env.DB.prepare(
            'UPDATE MultiplayerRooms SET Status = ? WHERE Code = ?'
          ).bind(RoomStatus.Finished, meta.roomCode).run();
          break;

        default:
          // Unknown message type — relay as-is
          this.broadcast(ws, msg);
      }
    } catch {
      // Invalid JSON — ignore
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const meta = this.connections.get(ws);
    this.connections.delete(ws);

    if (!meta) return;

    // Check if room is still playing
    const room = await this.env.DB.prepare(
      'SELECT Status, HostUserId FROM MultiplayerRooms WHERE Code = ?'
    ).bind(meta.roomCode).first<{ Status: number; HostUserId: string }>();

    if (room && room.Status === RoomStatus.Playing) {
      const disconnectedSide = room.HostUserId === meta.userId ? 'white' : 'black';

      // Notify others
      this.broadcastAll(JSON.stringify({
        type: 'OpponentDisconnected',
        data: { userId: meta.userId, timeoutSeconds: DISCONNECT_TIMEOUT_SECONDS },
      }));

      // Set a disconnect timer (20 seconds)
      this.disconnectTimers.set(meta.userId, Date.now() + DISCONNECT_TIMEOUT_SECONDS * 1000);

      // Schedule alarm for disconnect timeout
      const alarm = await this.state.storage.getAlarm();
      if (!alarm) {
        await this.state.storage.setAlarm(Date.now() + DISCONNECT_TIMEOUT_SECONDS * 1000);
      }
    } else {
      this.broadcastAll(JSON.stringify({
        type: 'OpponentDisconnected',
        data: { userId: meta.userId, timeoutSeconds: 0 },
      }));
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    const now = Date.now();

    for (const [userId, expiry] of this.disconnectTimers) {
      if (now >= expiry) {
        this.disconnectTimers.delete(userId);

        // Find the room for this user
        // Look up from any remaining connection in same room
        let roomCode: string | null = null;
        for (const meta of this.connections.values()) {
          roomCode = meta.roomCode;
          break;
        }

        if (roomCode) {
          const room = await this.env.DB.prepare(
            'SELECT HostUserId FROM MultiplayerRooms WHERE Code = ?'
          ).bind(roomCode).first<{ HostUserId: string }>();

          const disconnectedSide = room?.HostUserId === userId ? 'white' : 'black';

          await this.env.DB.prepare(
            'UPDATE MultiplayerRooms SET Status = ? WHERE Code = ?'
          ).bind(RoomStatus.Finished, roomCode).run();

          this.broadcastAll(JSON.stringify({
            type: 'GameOver',
            data: {
              reason: 'disconnection',
              disconnectedSide,
              detail: `${disconnectedSide === 'white' ? 'White' : 'Black'} disconnected and did not reconnect within ${DISCONNECT_TIMEOUT_SECONDS} seconds.`,
            },
          }));
        }
      }
    }

    // Re-schedule if there are more pending timers
    if (this.disconnectTimers.size > 0) {
      const nextExpiry = Math.min(...this.disconnectTimers.values());
      await this.state.storage.setAlarm(nextExpiry);
    }
  }

  /** Send to all connections except the sender. */
  private broadcast(sender: WebSocket, message: string): void {
    for (const [ws] of this.connections) {
      if (ws !== sender) {
        try { ws.send(message); } catch { /* closed */ }
      }
    }
  }

  /** Send to all connections. */
  private broadcastAll(message: string): void {
    for (const [ws] of this.connections) {
      try { ws.send(message); } catch { /* closed */ }
    }
  }
}
