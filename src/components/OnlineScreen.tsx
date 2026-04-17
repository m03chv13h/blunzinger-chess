import { useState, useEffect, useCallback } from 'react';
import type { GameSetupConfig } from '../core/blunziger/types';
import type { Color } from '../core/blunziger/types';
import { isStaticMode } from '../config/deployMode';
import { useLobby } from '../hooks/useLobby';
import { useGameHub } from '../hooks/useGameHub';
import type { RoomListItem } from '../services/lobbyService';
import './OnlineScreen.css';

interface OnlineScreenProps {
  /** Whether the user is authenticated (has a valid token). */
  authenticated: boolean;
  /** Called when the user joins a room and the game is ready to start. */
  onJoinGame?: (config: GameSetupConfig, roomCode: string, playerColor: Color, opponentName: string) => void;
}

export function OnlineScreen({ authenticated, onJoinGame }: OnlineScreenProps) {
  const lobby = useLobby();
  const [joinCode, setJoinCode] = useState('');
  const [hubError, setHubError] = useState<string | null>(null);
  const [playerJoined, setPlayerJoined] = useState(false);

  const hub = useGameHub({
    onPlayerJoined: () => setPlayerJoined(true),
    onError: (msg) => setHubError(msg),
  });

  // Fetch room list on mount (only when authenticated).
  useEffect(() => {
    if (authenticated) {
      lobby.refreshRooms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Connect to the SignalR hub when authenticated.
  useEffect(() => {
    if (authenticated && !hub.connected) {
      hub.connect().catch(() => {
        setHubError('Failed to connect to game server');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinCode.trim()) return;
    setHubError(null);
    setPlayerJoined(false);
    try {
      const res = await lobby.joinRoom(joinCode.trim().toUpperCase());
      await hub.joinRoom(res.code);
      setJoinCode('');

      // If the room has a match config, transition to the online game
      if (onJoinGame && res.matchConfig) {
        try {
          const config = JSON.parse(res.matchConfig) as GameSetupConfig;
          onJoinGame(config, res.code, 'b', res.hostDisplayName ?? 'Host');
        } catch {
          // Fallback: stay on the online screen
        }
      }
    } catch {
      // Error is already set in lobby state.
    }
  }, [joinCode, lobby, hub, onJoinGame]);

  const handleJoinFromList = useCallback(async (room: RoomListItem) => {
    setHubError(null);
    setPlayerJoined(false);
    try {
      const res = await lobby.joinRoom(room.code);
      await hub.joinRoom(res.code);

      // Transition to online game if match config is available
      if (onJoinGame && res.matchConfig) {
        try {
          const config = JSON.parse(res.matchConfig) as GameSetupConfig;
          onJoinGame(config, res.code, 'b', res.hostDisplayName ?? room.hostName);
        } catch {
          // Fallback: stay on the online screen
        }
      }
    } catch {
      // Error is already set in lobby state.
    }
  }, [lobby, hub, onJoinGame]);

  const handleLeaveRoom = useCallback(async () => {
    try {
      await hub.leaveRoom();
    } catch {
      // ignore
    }
    lobby.clearActiveRoom();
    setPlayerJoined(false);
  }, [hub, lobby]);

  // Static mode – online play is not available.
  if (isStaticMode) {
    return (
      <div className="online-screen">
        <div className="online-card">
          <h2>🌐 Join Online Game</h2>
          <p className="online-subtitle">Online play is not available in static mode.</p>
          <p className="online-empty">
            This instance is running as a standalone app without a backend connection.
            To play online, deploy the app with <code>VITE_DEPLOY_MODE=connected</code> and a running backend API.
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated – prompt to sign in.
  if (!authenticated) {
    return (
      <div className="online-screen">
        <div className="online-card">
          <h2>🌐 Join Online Game</h2>
          <p className="online-subtitle">Sign in to play online via WebSocket.</p>
          <p className="online-empty">
            Please sign in or create a guest account to access online play.
          </p>
        </div>
      </div>
    );
  }

  // Active room – show waiting / connected state.
  if (lobby.activeRoom) {
    return (
      <div className="online-screen">
        <div className="online-card">
          <h2>🌐 Join Online Game</h2>

          <div className="online-hub-status">
            <span className={`online-hub-dot ${hub.connected ? 'online-hub-dot--connected' : 'online-hub-dot--disconnected'}`} />
            {hub.connected ? 'Connected to server' : 'Connecting…'}
          </div>

          <div className="online-active-room">
            <p style={{ margin: 0, fontWeight: 600 }}>Room Code</p>
            <p className="online-room-code">{lobby.activeRoom.code}</p>
            <p className="online-room-status">
              {playerJoined
                ? '✅ Opponent joined — game ready!'
                : <><span className="online-waiting-spinner">⏳</span> Waiting for opponent…</>}
            </p>
            <button className="online-leave-btn" onClick={handleLeaveRoom}>
              Leave Room
            </button>
          </div>

          {(lobby.error || hubError) && (
            <p className="online-error">{lobby.error || hubError}</p>
          )}
        </div>
      </div>
    );
  }

  // Lobby – create / join / list rooms.
  return (
    <div className="online-screen">
      <div className="online-card">
        <h2>🌐 Join Online Game</h2>
        <p className="online-subtitle">
          Join a room using a code or pick one from the list.
        </p>

        <div className="online-hub-status">
          <span className={`online-hub-dot ${hub.connected ? 'online-hub-dot--connected' : 'online-hub-dot--disconnected'}`} />
          {hub.connected ? 'Connected to server' : 'Connecting…'}
        </div>

        {/* Join by code */}
        <div className="online-section">
          <h3>Join a Room</h3>
          <div className="online-join-row">
            <input
              className="online-join-input"
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }}
              maxLength={10}
              aria-label="Room code"
            />
            <button
              className="online-join-btn"
              onClick={handleJoinRoom}
              disabled={lobby.loading || !joinCode.trim() || !hub.connected}
            >
              Join
            </button>
          </div>
        </div>

        <div className="online-divider">or</div>

        {/* Room List */}
        <div className="online-section">
          <div className="online-room-list-header">
            <h3>Open Rooms</h3>
            <button
              className="online-refresh-btn"
              onClick={lobby.refreshRooms}
              disabled={lobby.loading}
            >
              ↻ Refresh
            </button>
          </div>

          {lobby.rooms.length === 0 ? (
            <p className="online-empty">No open rooms available.</p>
          ) : (
            <table className="online-room-table">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Code</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lobby.rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.hostName}</td>
                    <td>{room.code}</td>
                    <td>
                      <button
                        className="online-join-list-btn"
                        onClick={() => handleJoinFromList(room)}
                        disabled={lobby.loading || !hub.connected}
                      >
                        Join
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {(lobby.error || hubError) && (
          <p className="online-error">{lobby.error || hubError}</p>
        )}
      </div>
    </div>
  );
}
