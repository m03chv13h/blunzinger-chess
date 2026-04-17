using System.Security.Claims;
using BlunzigerChess.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlunzigerChess.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(AuthService authService, EnabledOAuthProviders enabledProviders) : ControllerBase
{
    /// <summary>Return the list of OAuth providers that are configured and available.</summary>
    [HttpGet("providers")]
    public IActionResult GetProviders()
    {
        return Ok(new { providers = enabledProviders.Providers });
    }

    /// <summary>Initiate OAuth login for a specific provider.</summary>
    [HttpGet("login/{provider}")]
    public IActionResult Login(string provider, [FromQuery] string? returnUrl = null)
    {
        if (!enabledProviders.Contains(provider, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { error = "Unsupported provider" });

        var properties = new AuthenticationProperties
        {
            RedirectUri = Url.Action(nameof(OAuthCallback), new { provider }),
            Items = { ["returnUrl"] = returnUrl ?? "/" }
        };

        // Pass existing guest user ID for potential upgrade
        var guestId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (guestId is not null)
            properties.Items["guestId"] = guestId;

        return Challenge(properties, provider);
    }

    /// <summary>OAuth callback — exchanges provider claims for a JWT.</summary>
    [HttpGet("callback/{provider}")]
    public async Task<IActionResult> OAuthCallback(string provider)
    {
        var result = await HttpContext.AuthenticateAsync("ExternalCookie");
        if (!result.Succeeded)
            return BadRequest(new { error = "Authentication failed" });

        // Clean up the temporary external cookie
        await HttpContext.SignOutAsync("ExternalCookie");

        var claims = result.Principal?.Claims.ToList() ?? [];
        var providerId = claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value
                      ?? throw new InvalidOperationException("No NameIdentifier claim");
        var displayName = claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value
                       ?? claims.FirstOrDefault(c => c.Type == ClaimTypes.GivenName)?.Value
                       ?? "User";
        var email = claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;
        var avatarUrl = claims.FirstOrDefault(c => c.Type == "urn:google:picture")?.Value
                     ?? claims.FirstOrDefault(c => c.Type == "avatar_url")?.Value;

        Guid? guestId = null;
        if (result.Properties?.Items.TryGetValue("guestId", out var guestIdStr) == true
            && Guid.TryParse(guestIdStr, out var parsed))
        {
            guestId = parsed;
        }

        var user = await authService.FindOrCreateOAuthUserAsync(
            provider, providerId, displayName, email, avatarUrl, guestId);

        var token = authService.GenerateJwtToken(user);
        var returnUrl = result.Properties?.Items["returnUrl"] ?? "/";

        // Redirect to frontend with token
        var separator = returnUrl.Contains('?') ? "&" : "?";
        return Redirect($"{returnUrl}{separator}token={token}");
    }

    /// <summary>Get a guest JWT for anonymous play.</summary>
    [HttpPost("guest")]
    public async Task<IActionResult> CreateGuest()
    {
        var user = await authService.CreateGuestUserAsync();
        var token = authService.GenerateJwtToken(user);
        return Ok(new { token, userId = user.Id, displayName = user.DisplayName });
    }

    /// <summary>Get the currently authenticated user's profile.</summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var displayName = User.FindFirstValue(ClaimTypes.Name);
        var isGuest = User.FindFirstValue("is_guest") == "true";
        var provider = User.FindFirstValue("provider");

        return Ok(new
        {
            userId,
            displayName,
            isGuest,
            provider,
        });
    }
}
