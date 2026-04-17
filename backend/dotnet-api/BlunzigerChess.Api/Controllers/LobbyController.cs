using System.Security.Claims;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LobbyController(AppDbContext db) : ControllerBase
{
    /// <summary>Create a new private multiplayer room.</summary>
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom([FromBody] CreateRoomRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var room = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = GenerateRoomCode(),
            HostUserId = userId.Value,
            MatchConfig = request.MatchConfig,
            Status = RoomStatus.Waiting,
            CreatedAt = DateTime.UtcNow,
        };

        db.MultiplayerRooms.Add(room);
        await db.SaveChangesAsync();

        return Ok(new { roomId = room.Id, code = room.Code });
    }

    /// <summary>Join a private room by code.</summary>
    [HttpPost("rooms/join")]
    public async Task<IActionResult> JoinRoom([FromBody] JoinRoomRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var room = await db.MultiplayerRooms
            .Include(r => r.Host)
            .FirstOrDefaultAsync(r => r.Code == request.Code && r.Status == RoomStatus.Waiting);

        if (room is null)
            return NotFound(new { error = "Room not found or already full" });

        if (room.HostUserId == userId)
            return BadRequest(new { error = "Cannot join your own room" });

        room.GuestUserId = userId.Value;
        room.Status = RoomStatus.Playing;
        await db.SaveChangesAsync();

        return Ok(new
        {
            roomId = room.Id,
            code = room.Code,
            matchConfig = room.MatchConfig,
            hostDisplayName = room.Host?.CustomDisplayName ?? room.Host?.DisplayName ?? "Unknown",
        });
    }

    /// <summary>List public waiting rooms.</summary>
    [HttpGet("rooms")]
    public async Task<IActionResult> ListRooms()
    {
        var rooms = await db.MultiplayerRooms
            .Where(r => r.Status == RoomStatus.Waiting)
            .OrderByDescending(r => r.CreatedAt)
            .Take(50)
            .Select(r => new
            {
                r.Id,
                r.Code,
                r.MatchConfig,
                r.CreatedAt,
                HostName = r.Host != null ? (r.Host.CustomDisplayName ?? r.Host.DisplayName) : "Unknown",
            })
            .ToListAsync();

        return Ok(new { rooms });
    }

    /// <summary>Join the matchmaking queue.</summary>
    [HttpPost("matchmaking")]
    public async Task<IActionResult> JoinMatchmaking([FromBody] JoinMatchmakingRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        // Remove any existing queue entry for this user
        var existing = await db.MatchmakingQueue
            .Where(e => e.UserId == userId.Value && e.Status == MatchmakingStatus.Queued)
            .ToListAsync();
        db.MatchmakingQueue.RemoveRange(existing);

        var entry = new MatchmakingEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            PreferredConfig = request.PreferredConfig,
            Status = MatchmakingStatus.Queued,
            JoinedAt = DateTime.UtcNow,
        };

        db.MatchmakingQueue.Add(entry);
        await db.SaveChangesAsync();

        return Ok(new { entryId = entry.Id });
    }

    /// <summary>Cancel matchmaking.</summary>
    [HttpDelete("matchmaking")]
    public async Task<IActionResult> CancelMatchmaking()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var entries = await db.MatchmakingQueue
            .Where(e => e.UserId == userId.Value && e.Status == MatchmakingStatus.Queued)
            .ToListAsync();

        foreach (var entry in entries)
            entry.Status = MatchmakingStatus.Cancelled;

        await db.SaveChangesAsync();

        return NoContent();
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
    }

    private static string GenerateRoomCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}

public record CreateRoomRequest
{
    public required string MatchConfig { get; init; }
}

public record JoinRoomRequest
{
    public required string Code { get; init; }
}

public record JoinMatchmakingRequest
{
    public required string PreferredConfig { get; init; }
}
