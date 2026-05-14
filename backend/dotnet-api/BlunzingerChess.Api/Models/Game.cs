using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlunzingerChess.Api.Models;

public class Game
{
    public Guid Id { get; set; }

    /// <summary>User who played or saved this game. Nullable for anonymous guests tracked by session.</summary>
    public Guid? UserId { get; set; }

    /// <summary>Match configuration as JSON (mirrors TypeScript MatchConfig).</summary>
    [Column(TypeName = "jsonb")]
    public string MatchConfig { get; set; } = "{}";

    /// <summary>Final game state as JSON (mirrors TypeScript GameState).</summary>
    [Column(TypeName = "jsonb")]
    public string? GameStateJson { get; set; }

    /// <summary>Game result as JSON.</summary>
    [Column(TypeName = "jsonb")]
    public string? Result { get; set; }

    /// <summary>Final scores as JSON.</summary>
    [Column(TypeName = "jsonb")]
    public string? Scores { get; set; }

    /// <summary>Position history for review as JSON.</summary>
    [Column(TypeName = "jsonb")]
    public string? PositionHistory { get; set; }

    /// <summary>Move history as JSON.</summary>
    [Column(TypeName = "jsonb")]
    public string? MoveHistory { get; set; }

    /// <summary>Final FEN position (for thumbnail).</summary>
    [MaxLength(200)]
    public string? FinalFen { get; set; }

    public int MoveCount { get; set; }

    /// <summary>Game mode: "local", "multiplayer".</summary>
    [MaxLength(20)]
    public string GameMode { get; set; } = "local";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    // Navigation
    public User? User { get; set; }
}
