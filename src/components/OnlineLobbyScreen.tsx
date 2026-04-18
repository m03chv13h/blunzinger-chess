import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameSetupConfig } from '../core/blunziger/types';
import type { Color } from '../core/blunziger/types';
import { isStaticMode } from '../config/deployMode';
import { useLobby } from '../hooks/useLobby';
import { useGameHub } from '../hooks/useGameHub';
import type { PlayerJoinedEvent } from '../hooks/useGameHub';
import { GameSummaryPanel } from './GameSummaryPanel';
import './OnlineLobbyScreen.css';

interface OnlineLobbyScreenProps {
  config: GameSetupConfig;
  authenticated: boolean;
  onGameReady: (roomCode: string, playerColor: Color, opponentName: string) => void;
  onCancel: () => void;
}

/** How long (in seconds) to wait for an opponent before auto-closing. */
const LOBBY_TIMEOUT_SECONDS = 60;

export function OnlineLobbyScreen({
  config,
  authenticated,
  onGameReady,
  onCancel,
}: OnlineLobbyScreenProps) {
  const lobby = useLobby();
  const [hubError, setHubError] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(LOBBY_TIMEOUT_SECONDS);
  const createdRef = useRef(false);
  const roomCodeRef = useRef<string | null>(null);

  const handlePlayerJoined = useCallback((event: PlayerJoinedEvent) => {
    // When the status is "Playing", both players are in the room
    if (event.status === 'Playing' && roomCodeRef.current) {
      // The joining user's display name — use it if it's different from us
      setOpponentName(event.displayName ?? 'Opponent');
      // Host always plays white
      onGameReady(roomCodeRef.current, 'w', event.displayName ?? 'Opponent');
    }
  }, [onGameReady]);

  const handleRoomExpired = useCallback(() => {
    if (cancelRef.current) return;
    cancelRef.current = true;
    lobby.clearActiveRoom();
    onCancel();
  }, [lobby, onCancel]);

  const hub = useGameHub({
    onPlayerJoined: handlePlayerJoined,
    onRoomExpired: handleRoomExpired,
    onError: (msg) => setHubError(msg),
  });

  // Connect to hub and create room on mount.
  // Dependencies are limited to `authenticated` to run only when auth
  // state is ready. `hub`, `lobby`, and `config` are stable across
  // renders (hooks return memoized objects) and including them would
  // trigger duplicate room creation.
  useEffect(() => {
    if (!authenticated || isStaticMode || createdRef.current) return;
    createdRef.current = true;

    (async () => {
      try {
        // Connect to the SignalR hub
        if (!hub.connected) {
          await hub.connect();
        }

        // Create the room with serialized game config
        const matchConfigJson = JSON.stringify(config);
        const res = await lobby.createRoom(matchConfigJson);
        roomCodeRef.current = res.code;

        // Join the SignalR room group
        await hub.joinRoom(res.code);

        // Autopair: the server paired us with an existing room as guest (black)
        if (res.paired) {
          onGameReady(res.code, 'b', res.hostDisplayName ?? 'Opponent');
          return;
        }
      } catch {
        setHubError('Failed to create room');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // ── Countdown timer — auto-cancel after LOBBY_TIMEOUT_SECONDS ────
  const cancelRef = useRef(false);

  useEffect(() => {
    // Only start the countdown once the room code is visible
    if (!lobby.activeRoom?.code || opponentName) return;

    const id = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [lobby.activeRoom?.code, opponentName]);

  // Trigger cancel when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && !opponentName && !cancelRef.current) {
      cancelRef.current = true;
      // Fire-and-forget: leave the room and notify the parent
      (async () => {
        try {
          await hub.leaveRoom();
        } catch {
          // ignore
        }
        lobby.clearActiveRoom();
        onCancel();
      })();
    }
  }, [countdown, opponentName, hub, lobby, onCancel]);

  const handleCancel = useCallback(async () => {
    try {
      await hub.leaveRoom();
    } catch {
      // ignore
    }
    lobby.clearActiveRoom();
    onCancel();
  }, [hub, lobby, onCancel]);

  const roomCode = lobby.activeRoom?.code ?? roomCodeRef.current;

  return (
    <div className="online-lobby-screen">
      <div className="online-lobby-card">
        <h2>🌐 Online Game</h2>
        <p className="online-lobby-subtitle">
          Waiting for an opponent to join your game.
        </p>

        {/* Hub connection status */}
        <div className="online-lobby-hub-status">
          <span className={`online-lobby-hub-dot ${hub.connected ? 'online-lobby-hub-dot--connected' : 'online-lobby-hub-dot--disconnected'}`} />
          {hub.connected ? 'Connected to server' : 'Connecting…'}
        </div>

        {/* Game config summary */}
        <div className="online-lobby-config-summary">
          <GameSummaryPanel config={config} />
        </div>

        {/* Room code display */}
        {roomCode ? (
          <div className="online-lobby-room">
            <p className="online-lobby-room-title">Share this code with your opponent:</p>
            <p className="online-lobby-room-code">{roomCode}</p>
            <p className="online-lobby-waiting">
              <span className="online-lobby-spinner">⏳</span> Waiting for opponent…
            </p>
            {!opponentName && (
              <p className="online-lobby-countdown">
                Room closes in {countdown}s
              </p>
            )}
            {opponentName && (
              <p className="online-lobby-joined">✅ {opponentName} joined!</p>
            )}
          </div>
        ) : (
          <div className="online-lobby-creating">
            {lobby.loading ? 'Creating room…' : 'Preparing…'}
          </div>
        )}

        {/* Error display */}
        {(lobby.error || hubError) && (
          <p className="online-lobby-error">{lobby.error || hubError}</p>
        )}

        <button className="online-lobby-cancel-btn" onClick={handleCancel}>
          ← Cancel
        </button>
      </div>
    </div>
  );
}
