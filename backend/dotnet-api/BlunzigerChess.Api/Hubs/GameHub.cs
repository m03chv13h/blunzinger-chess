using System.Collections.Concurrent;
using System.Security.Claims;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.GrpcClients;
using BlunzigerChess.Api.Models;
using BlunzigerChess.Proto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Hubs;

/// <summary>
/// SignalR hub for real-time multiplayer chess games.
/// All moves are validated server-side via the Node.js game engine worker.
/// </summary>
[Authorize]
public class GameHub(
    AppDbContext db,
    GameEngineClient engineClient,
    ILogger<GameHub> logger) : Hub
{
    /// <summary>Maps room codes to group names for SignalR.</summary>
    private static string RoomGroup(string code) => $"room_{code}";

    /// <summary>Track active room connections: connectionId → roomCode.</summary>
    private static readonly ConcurrentDictionary<string, string> ConnectionRooms = new();

    // ── Connection Lifecycle ─────────────────────────────────────────

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ConnectionRooms.TryRemove(Context.ConnectionId, out var roomCode))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomCode));
            await Clients.Group(RoomGroup(roomCode)).SendAsync("OpponentDisconnected", new
            {
                userId = GetUserId().ToString(),
            });
            logger.LogInformation("Player {User} disconnected from room {Room}",
                GetUserId(), roomCode);
        }
        await base.OnDisconnectedAsync(exception);
    }

    // ── Room Management ──────────────────────────────────────────────

    /// <summary>Join a multiplayer room (called after REST room creation/join).</summary>
    public async Task JoinRoom(string roomCode)
    {
        var userId = GetUserId();
        var room = await db.MultiplayerRooms
            .Include(r => r.Host)
            .Include(r => r.Guest)
            .FirstOrDefaultAsync(r => r.Code == roomCode);

        if (room is null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return;
        }

        if (room.HostUserId != userId && room.GuestUserId != userId)
        {
            await Clients.Caller.SendAsync("Error", "Not a member of this room");
            return;
        }

        // Track connection → room mapping
        ConnectionRooms[Context.ConnectionId] = roomCode;
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(roomCode));

        var user = room.HostUserId == userId ? room.Host : room.Guest;
        await Clients.Group(RoomGroup(roomCode)).SendAsync("PlayerJoined", new
        {
            userId = userId.ToString(),
            displayName = user?.EffectiveDisplayName ?? "Unknown",
            roomCode,
            status = room.Status.ToString(),
            gameState = room.CurrentGameState,
            matchConfig = room.MatchConfig,
        });

        logger.LogInformation("Player {User} joined room {Room}", userId, roomCode);
    }

    /// <summary>Leave the current room.</summary>
    public async Task LeaveRoom()
    {
        if (ConnectionRooms.TryRemove(Context.ConnectionId, out var roomCode))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomCode));
            await Clients.Group(RoomGroup(roomCode)).SendAsync("PlayerLeft", new
            {
                userId = GetUserId().ToString(),
            });
        }
    }

    // ── Game Actions ─────────────────────────────────────────────────

    /// <summary>
    /// Make a move. The move is validated server-side via gRPC to the Node worker
    /// before being broadcast to the room.
    /// </summary>
    public async Task MakeMove(string roomCode, ChessMove move)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        if (string.IsNullOrEmpty(room.CurrentGameState))
        {
            await Clients.Caller.SendAsync("Error", "Game not started");
            return;
        }

        try
        {
            // Parse current state and apply move via Node worker
            var currentState = Proto.GameState.Parser.ParseJson(room.CurrentGameState);
            var newState = await engineClient.ApplyMoveAsync(currentState, move);

            // Persist updated state
            room.CurrentGameState = newState.ToString();
            if (newState.Result is not null)
            {
                room.Status = Models.RoomStatus.Finished;
            }
            await db.SaveChangesAsync();

            // Broadcast to both players
            await Clients.Group(RoomGroup(roomCode)).SendAsync("GameStateUpdated", new
            {
                gameState = room.CurrentGameState,
                move = move.ToString(),
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Invalid move in room {Room}", roomCode);
            await Clients.Caller.SendAsync("MoveRejected", new { error = ex.Message });
        }
    }

    /// <summary>Make a drop move (Crazyhouse).</summary>
    public async Task MakeDropMove(string roomCode, DropMove drop)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        if (string.IsNullOrEmpty(room.CurrentGameState))
        {
            await Clients.Caller.SendAsync("Error", "Game not started");
            return;
        }

        try
        {
            var currentState = Proto.GameState.Parser.ParseJson(room.CurrentGameState);
            var newState = await engineClient.ApplyDropMoveAsync(currentState, drop);

            room.CurrentGameState = newState.ToString();
            if (newState.Result is not null)
                room.Status = Models.RoomStatus.Finished;
            await db.SaveChangesAsync();

            await Clients.Group(RoomGroup(roomCode)).SendAsync("GameStateUpdated", new
            {
                gameState = room.CurrentGameState,
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Invalid drop in room {Room}", roomCode);
            await Clients.Caller.SendAsync("MoveRejected", new { error = ex.Message });
        }
    }

    /// <summary>Report a violation (Report Incorrectness game type).</summary>
    public async Task ReportViolation(string roomCode)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null || string.IsNullOrEmpty(room.CurrentGameState)) return;

        try
        {
            var userId = GetUserId();
            var side = room.HostUserId == userId ? Proto.Color.White : Proto.Color.Black;

            var currentState = Proto.GameState.Parser.ParseJson(room.CurrentGameState);
            var newState = await engineClient.ReportViolationAsync(currentState, side);

            room.CurrentGameState = newState.ToString();
            if (newState.Result is not null)
                room.Status = Models.RoomStatus.Finished;
            await db.SaveChangesAsync();

            await Clients.Group(RoomGroup(roomCode)).SendAsync("GameStateUpdated", new
            {
                gameState = room.CurrentGameState,
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Report failed in room {Room}", roomCode);
            await Clients.Caller.SendAsync("Error", new { error = ex.Message });
        }
    }

    /// <summary>Select a piece for removal during piece removal penalty.</summary>
    public async Task SelectPieceForRemoval(string roomCode, string square)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null || string.IsNullOrEmpty(room.CurrentGameState)) return;

        try
        {
            var currentState = Proto.GameState.Parser.ParseJson(room.CurrentGameState);
            var newState = await engineClient.ApplyPieceRemovalAsync(currentState, square);

            room.CurrentGameState = newState.ToString();
            if (newState.Result is not null)
                room.Status = Models.RoomStatus.Finished;
            await db.SaveChangesAsync();

            await Clients.Group(RoomGroup(roomCode)).SendAsync("GameStateUpdated", new
            {
                gameState = room.CurrentGameState,
            });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Piece removal failed in room {Room}", roomCode);
            await Clients.Caller.SendAsync("Error", new { error = ex.Message });
        }
    }

    /// <summary>Resign the game.</summary>
    public async Task ResignGame(string roomCode)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null || string.IsNullOrEmpty(room.CurrentGameState)) return;

        room.Status = Models.RoomStatus.Finished;
        await db.SaveChangesAsync();

        var userId = GetUserId();
        var resigningSide = room.HostUserId == userId ? "white" : "black";

        await Clients.Group(RoomGroup(roomCode)).SendAsync("GameOver", new
        {
            reason = "resignation",
            resigningSide,
        });
    }

    /// <summary>Offer a draw.</summary>
    public async Task OfferDraw(string roomCode)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        await Clients.OthersInGroup(RoomGroup(roomCode)).SendAsync("DrawOffered", new
        {
            offeredBy = GetUserId().ToString(),
        });
    }

    /// <summary>Accept a draw offer.</summary>
    public async Task AcceptDraw(string roomCode)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        room.Status = Models.RoomStatus.Finished;
        await db.SaveChangesAsync();

        await Clients.Group(RoomGroup(roomCode)).SendAsync("GameOver", new
        {
            reason = "draw",
            detail = "Draw by agreement",
        });
    }

    // ── Client-Side Relay (moves applied locally on both clients) ───

    /// <summary>Relay a standard move to the opponent (client-side game engine).</summary>
    public async Task SendMove(string roomCode, string from, string to, string? promotion)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        await Clients.OthersInGroup(RoomGroup(roomCode)).SendAsync("OpponentMoved", new
        {
            from,
            to,
            promotion,
        });
    }

    /// <summary>Relay a Crazyhouse drop move to the opponent.</summary>
    public async Task SendDropMove(string roomCode, string pieceType, string square)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        await Clients.OthersInGroup(RoomGroup(roomCode)).SendAsync("OpponentDropMove", new
        {
            pieceType,
            square,
        });
    }

    /// <summary>Relay a violation report to the opponent.</summary>
    public async Task SendReport(string roomCode)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        await Clients.OthersInGroup(RoomGroup(roomCode)).SendAsync("OpponentReported");
    }

    /// <summary>Relay a piece removal selection to the opponent.</summary>
    public async Task SendPieceRemoval(string roomCode, string square)
    {
        var room = await GetAuthorizedRoomAsync(roomCode);
        if (room is null) return;

        await Clients.OthersInGroup(RoomGroup(roomCode)).SendAsync("OpponentPieceRemoval", new
        {
            square,
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private Guid GetUserId()
    {
        var claim = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        return claim is not null && Guid.TryParse(claim, out var id) ? id : Guid.Empty;
    }

    private async Task<MultiplayerRoom?> GetAuthorizedRoomAsync(string roomCode)
    {
        var userId = GetUserId();
        var room = await db.MultiplayerRooms
            .FirstOrDefaultAsync(r => r.Code == roomCode);

        if (room is null)
        {
            await Clients.Caller.SendAsync("Error", "Room not found");
            return null;
        }

        if (room.HostUserId != userId && room.GuestUserId != userId)
        {
            await Clients.Caller.SendAsync("Error", "Not authorized");
            return null;
        }

        return room;
    }
}
