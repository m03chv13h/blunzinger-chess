using System.ComponentModel.DataAnnotations;

namespace BlunzigerChess.Api.Models;

public enum RoomStatus
{
    Waiting,
    Playing,
    Finished,
    Cancelled
}

public class MultiplayerRoom
{
    public Guid Id { get; set; }

    /// <summary>Short code for sharing / joining (e.g. "ABC123").</summary>
    [MaxLength(10)]
    public string Code { get; set; } = string.Empty;

    public Guid HostUserId { get; set; }

    public Guid? GuestUserId { get; set; }

    /// <summary>Match configuration chosen by the host, as JSON.</summary>
    public string MatchConfig { get; set; } = "{}";

    /// <summary>Current game state as JSON (kept in sync during play).</summary>
    public string? CurrentGameState { get; set; }

    public RoomStatus Status { get; set; } = RoomStatus.Waiting;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Timestamp of the last game activity (move, report, etc.). Used by cleanup to detect abandoned games.</summary>
    public DateTime? LastActivityAt { get; set; }

    /// <summary>Associated game record (created when the game finishes).</summary>
    public Guid? GameId { get; set; }

    // Navigation
    public User? Host { get; set; }
    public User? Guest { get; set; }
    public Game? Game { get; set; }
}
