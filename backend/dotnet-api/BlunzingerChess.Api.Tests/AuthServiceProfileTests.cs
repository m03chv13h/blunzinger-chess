using BlunzingerChess.Api.Data;
using BlunzingerChess.Api.Models;
using BlunzingerChess.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace BlunzingerChess.Api.Tests;

public class AuthServiceProfileTests
{
    private static (AppDbContext db, AuthService service) CreateTestService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "test-secret-key-with-at-least-32-chars!!",
                ["Jwt:Issuer"] = "TestIssuer",
                ["Jwt:Audience"] = "TestAudience",
            })
            .Build();

        var service = new AuthService(db, config);
        return (db, service);
    }

    [Fact]
    public async Task FindOrCreateOAuthUser_DoesNotOverwriteCustomDisplayName()
    {
        var (db, service) = CreateTestService();

        // First login — creates the user with provider name
        var user = await service.FindOrCreateOAuthUserAsync(
            "Google", "google-123", "Provider Name", "user@example.com", "https://avatar.com/pic.jpg");

        // User sets a custom display name
        user.CustomDisplayName = "My Custom Name";
        user.CustomAvatarUrl = "sausage_classic";
        await db.SaveChangesAsync();

        // Second login — provider data updates but custom fields should remain
        var sameUser = await service.FindOrCreateOAuthUserAsync(
            "Google", "google-123", "Updated Provider Name", "user@example.com", "https://avatar.com/new-pic.jpg");

        Assert.Equal(user.Id, sameUser.Id);
        // Provider fields should be updated
        Assert.Equal("Updated Provider Name", sameUser.DisplayName);
        Assert.Equal("https://avatar.com/new-pic.jpg", sameUser.AvatarUrl);
        // Custom fields should be preserved
        Assert.Equal("My Custom Name", sameUser.CustomDisplayName);
        Assert.Equal("sausage_classic", sameUser.CustomAvatarUrl);
        // Effective should return custom values
        Assert.Equal("My Custom Name", sameUser.EffectiveDisplayName);
        Assert.Equal("sausage_classic", sameUser.EffectiveAvatarUrl);
    }

    [Fact]
    public async Task FindOrCreateOAuthUser_UsesProviderName_WhenNoCustomSet()
    {
        var (_, service) = CreateTestService();

        var user = await service.FindOrCreateOAuthUserAsync(
            "GitHub", "gh-456", "GitHub User", null, "https://github.com/avatar.jpg");

        Assert.Equal("GitHub User", user.DisplayName);
        Assert.Null(user.CustomDisplayName);
        Assert.Equal("GitHub User", user.EffectiveDisplayName);
        Assert.Equal("https://github.com/avatar.jpg", user.EffectiveAvatarUrl);
    }

    [Fact]
    public async Task CreateGuestUser_HasNoCustomFields()
    {
        var (_, service) = CreateTestService();

        var user = await service.CreateGuestUserAsync();

        Assert.StartsWith("Guest_", user.DisplayName);
        Assert.Null(user.CustomDisplayName);
        Assert.Null(user.CustomAvatarUrl);
        Assert.Equal(user.DisplayName, user.EffectiveDisplayName);
        Assert.Null(user.EffectiveAvatarUrl);
    }

    [Fact]
    public async Task GuestUpgradeToOAuth_PreservesCustomFields()
    {
        var (db, service) = CreateTestService();

        // Create guest
        var guest = await service.CreateGuestUserAsync();
        guest.CustomDisplayName = "Cool Guest Name";
        guest.CustomAvatarUrl = "sausage_bratwurst";
        await db.SaveChangesAsync();

        // Upgrade guest to OAuth
        var upgraded = await service.FindOrCreateOAuthUserAsync(
            "Discord", "discord-789", "Discord User", "user@discord.com", null,
            existingGuestId: guest.Id);

        Assert.Equal(guest.Id, upgraded.Id);
        Assert.False(upgraded.IsGuest);
        // Provider fields updated
        Assert.Equal("Discord User", upgraded.DisplayName);
        // Custom fields preserved
        Assert.Equal("Cool Guest Name", upgraded.CustomDisplayName);
        Assert.Equal("sausage_bratwurst", upgraded.CustomAvatarUrl);
        // Effective returns custom
        Assert.Equal("Cool Guest Name", upgraded.EffectiveDisplayName);
        Assert.Equal("sausage_bratwurst", upgraded.EffectiveAvatarUrl);
    }
}
