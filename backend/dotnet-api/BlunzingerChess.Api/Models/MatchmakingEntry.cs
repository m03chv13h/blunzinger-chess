using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlunzingerChess.Api.Models;

public enum MatchmakingStatus
{
    Queued,
    Matched,
    Cancelled,
    Expired
}

public class MatchmakingEntry
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    /// <summary>Preferred game configuration for matching, as JSON.</summary>
    [Column(TypeName = "jsonb")]
    public string PreferredConfig { get; set; } = "{}";

    public MatchmakingStatus Status { get; set; } = MatchmakingStatus.Queued;

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Room created when matched. Null until match is found.</summary>
    public Guid? RoomId { get; set; }

    // Navigation
    public User? User { get; set; }
    public MultiplayerRoom? Room { get; set; }
}
