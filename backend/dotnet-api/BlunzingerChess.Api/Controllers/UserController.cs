using System.Security.Claims;
using BlunzingerChess.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzingerChess.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController(AppDbContext db) : ControllerBase
{
    /// <summary>Get user profile with game statistics.</summary>
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await db.Users.FindAsync(userId.Value);
        if (user is null) return NotFound();

        var gameCount = await db.Games.CountAsync(g => g.UserId == userId);

        return Ok(new
        {
            user.Id,
            DisplayName = user.EffectiveDisplayName,
            user.Email,
            AvatarUrl = user.EffectiveAvatarUrl,
            user.Provider,
            user.IsGuest,
            user.CreatedAt,
            GameCount = gameCount,
            ProviderDisplayName = user.DisplayName,
            ProviderAvatarUrl = user.AvatarUrl,
        });
    }

    /// <summary>Update display name and/or avatar URL.</summary>
    [HttpPatch("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await db.Users.FindAsync(userId.Value);
        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
            user.CustomDisplayName = request.DisplayName.Trim();

        if (request.AvatarUrl is not null)
            user.CustomAvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();

        await db.SaveChangesAsync();

        return Ok(new { user.Id, DisplayName = user.EffectiveDisplayName, AvatarUrl = user.EffectiveAvatarUrl });
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
    }
}

public record UpdateProfileRequest
{
    public string? DisplayName { get; init; }
    public string? AvatarUrl { get; init; }
}
