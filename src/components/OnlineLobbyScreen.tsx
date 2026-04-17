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

export function OnlineLobbyScreen({
  config,
  authenticated,
  onGameReady,
  onCancel,
}: OnlineLobbyScreenProps) {
  const lobby = useLobby();
  const [hubError, setHubError] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
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

  const hub = useGameHub({
    onPlayerJoined: handlePlayerJoined,
    onError: (msg) => setHubError(msg),
  });

  // Connect to hub and create room on mount
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
      } catch {
        setHubError('Failed to create room');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

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
