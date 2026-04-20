using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlunzigerChess.Api.Models;

/// <summary>
/// A batch simulation run containing multiple bot-vs-bot games.
/// Stores the configuration, results summary, and all individual game records.
/// </summary>
public class Simulation
{
    public Guid Id { get; set; }

    /// <summary>User who ran this simulation. Nullable for anonymous guests.</summary>
    public Guid? UserId { get; set; }

    /// <summary>Game setup configuration as JSON (mirrors TypeScript GameSetupConfig).</summary>
    [Column(TypeName = "jsonb")]
    public string ConfigJson { get; set; } = "{}";

    /// <summary>Number of games in this simulation.</summary>
    public int GameCount { get; set; }

    /// <summary>Number of white wins.</summary>
    public int WhiteWins { get; set; }

    /// <summary>Number of black wins.</summary>
    public int BlackWins { get; set; }

    /// <summary>Number of draws.</summary>
    public int Draws { get; set; }

    /// <summary>All game records as a JSON array (mirrors TypeScript GameRecord[]).</summary>
    [Column(TypeName = "jsonb")]
    public string GamesJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    // Navigation
    public User? User { get; set; }
}
