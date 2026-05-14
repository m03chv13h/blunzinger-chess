using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BlunzingerChess.Api.Data;
using BlunzingerChess.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace BlunzingerChess.Api.Services;

public class AuthService(AppDbContext db, IConfiguration config)
{
    /// <summary>
    /// Find or create a user from OAuth claims. If a guest user with the same session
    /// is being upgraded, link the existing guest to the OAuth account.
    /// </summary>
    public async Task<User> FindOrCreateOAuthUserAsync(
        string provider, string providerId, string displayName, string? email, string? avatarUrl,
        Guid? existingGuestId = null)
    {
        // Check if this OAuth identity already exists
        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Provider == provider && u.ProviderId == providerId);

        if (user is not null)
        {
            // Update profile info from provider
            user.DisplayName = displayName;
            user.Email = email;
            user.AvatarUrl = avatarUrl;
            await db.SaveChangesAsync();
            return user;
        }

        // If upgrading a guest account, convert it
        if (existingGuestId.HasValue)
        {
            user = await db.Users.FindAsync(existingGuestId.Value);
            if (user is not null && user.IsGuest)
            {
                user.Provider = provider;
                user.ProviderId = providerId;
                user.DisplayName = displayName;
                user.Email = email;
                user.AvatarUrl = avatarUrl;
                user.IsGuest = false;
                await db.SaveChangesAsync();
                return user;
            }
        }

        // Create new user
        user = new User
        {
            Id = Guid.NewGuid(),
            Provider = provider,
            ProviderId = providerId,
            DisplayName = displayName,
            Email = email,
            AvatarUrl = avatarUrl,
            IsGuest = false,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    /// <summary>Create a guest user with a temporary identity.</summary>
    public async Task<User> CreateGuestUserAsync()
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            Provider = "guest",
            DisplayName = $"Guest_{Guid.NewGuid().ToString()[..8]}",
            IsGuest = true,
            CreatedAt = DateTime.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    /// <summary>Generate a JWT token for the given user.</summary>
    public string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(config["Jwt:Secret"]
                ?? throw new InvalidOperationException("JWT secret not configured")));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.EffectiveDisplayName),
            new("is_guest", user.IsGuest.ToString().ToLowerInvariant()),
            new("provider", user.Provider),
        };

        if (user.Email is not null)
            claims.Add(new Claim(ClaimTypes.Email, user.Email));

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"] ?? "BlunzingerChess",
            audience: config["Jwt:Audience"] ?? "BlunzingerChess",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(user.IsGuest ? 30 : 90),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
