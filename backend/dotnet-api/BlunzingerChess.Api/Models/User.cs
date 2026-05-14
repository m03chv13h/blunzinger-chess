using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlunzingerChess.Api.Models;

public class User
{
    public Guid Id { get; set; }

    /// <summary>Display name sourced from the OAuth provider (or generated for guests).</summary>
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    [MaxLength(256)]
    public string? Email { get; set; }

    /// <summary>Avatar URL sourced from the OAuth provider.</summary>
    [MaxLength(512)]
    public string? AvatarUrl { get; set; }

    /// <summary>User-set custom display name. When set, takes priority over the provider name.</summary>
    [MaxLength(100)]
    public string? CustomDisplayName { get; set; }

    /// <summary>User-set custom avatar URL. When set, takes priority over the provider avatar.</summary>
    [MaxLength(512)]
    public string? CustomAvatarUrl { get; set; }

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

    /// <summary>Effective display name: custom name if set, otherwise provider name.</summary>
    [NotMapped]
    public string EffectiveDisplayName => CustomDisplayName ?? DisplayName;

    /// <summary>Effective avatar URL: custom avatar if set, otherwise provider avatar.</summary>
    [NotMapped]
    public string? EffectiveAvatarUrl => CustomAvatarUrl ?? AvatarUrl;
}
