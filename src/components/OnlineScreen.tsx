import { useState, useEffect, useCallback } from 'react';
import { useLobby } from '../hooks/useLobby';
import { useGameHub } from '../hooks/useGameHub';
import type { RoomListItem } from '../services/lobbyService';
import './OnlineScreen.css';

interface OnlineScreenProps {
  /** Whether the user is authenticated (has a valid token). */
  authenticated: boolean;
}

export function OnlineScreen({ authenticated }: OnlineScreenProps) {
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

  const handleCreateRoom = useCallback(async () => {
    setHubError(null);
    setPlayerJoined(false);
    try {
      const res = await lobby.createRoom('{}');
      // Join the SignalR room group after REST creation.
      await hub.joinRoom(res.code);
    } catch {
      // Error is already set in lobby state.
    }
  }, [lobby, hub]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinCode.trim()) return;
    setHubError(null);
    setPlayerJoined(false);
    try {
      const res = await lobby.joinRoom(joinCode.trim().toUpperCase());
      await hub.joinRoom(res.code);
      setJoinCode('');
    } catch {
      // Error is already set in lobby state.
    }
  }, [joinCode, lobby, hub]);

  const handleJoinFromList = useCallback(async (room: RoomListItem) => {
    setHubError(null);
    setPlayerJoined(false);
    try {
      const res = await lobby.joinRoom(room.code);
      await hub.joinRoom(res.code);
    } catch {
      // Error is already set in lobby state.
    }
  }, [lobby, hub]);

  const handleLeaveRoom = useCallback(async () => {
    try {
      await hub.leaveRoom();
    } catch {
      // ignore
    }
    lobby.clearActiveRoom();
    setPlayerJoined(false);
  }, [hub, lobby]);

  // Not authenticated – prompt to sign in.
  if (!authenticated) {
    return (
      <div className="online-screen">
        <div className="online-card">
          <h2>🌐 Play Online</h2>
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
          <h2>🌐 Play Online</h2>

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
        <h2>🌐 Play Online</h2>
        <p className="online-subtitle">
          Create a room or join one using a code.
        </p>

        <div className="online-hub-status">
          <span className={`online-hub-dot ${hub.connected ? 'online-hub-dot--connected' : 'online-hub-dot--disconnected'}`} />
          {hub.connected ? 'Connected to server' : 'Connecting…'}
        </div>

        {/* Create Room */}
        <div className="online-section">
          <h3>Create a Room</h3>
          <button
            className="online-create-btn"
            onClick={handleCreateRoom}
            disabled={lobby.loading || !hub.connected}
          >
            {lobby.loading ? 'Creating…' : '➕ Create Room'}
          </button>
        </div>

        <div className="online-divider">or</div>

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
