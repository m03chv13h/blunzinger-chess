using System.ComponentModel.DataAnnotations;

namespace BlunzigerChess.Api.Models;

public class User
{
    public Guid Id { get; set; }

    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(256)]
    public string? Email { get; set; }

    [MaxLength(512)]
    public string? AvatarUrl { get; set; }

    /// <summary>OAuth provider name (Google, GitHub, Discord, Microsoft) or "guest".</summary>
    [MaxLength(50)]
    public string Provider { get; set; } = "guest";

    /// <summary>Provider-specific user ID.</summary>
    [MaxLength(256)]
    public string? ProviderId { get; set; }

    public bool IsGuest { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Game> Games { get; set; } = [];
}
