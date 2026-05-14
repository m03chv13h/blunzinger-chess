using BlunzingerChess.Api.Models;

namespace BlunzingerChess.Api.Tests;

public class UserProfileTests
{
    [Fact]
    public void EffectiveDisplayName_ReturnsCustom_WhenSet()
    {
        var user = new User
        {
            DisplayName = "ProviderName",
            CustomDisplayName = "MyCustomName",
        };

        Assert.Equal("MyCustomName", user.EffectiveDisplayName);
    }

    [Fact]
    public void EffectiveDisplayName_FallsBackToProvider_WhenCustomIsNull()
    {
        var user = new User
        {
            DisplayName = "ProviderName",
            CustomDisplayName = null,
        };

        Assert.Equal("ProviderName", user.EffectiveDisplayName);
    }

    [Fact]
    public void EffectiveAvatarUrl_ReturnsCustom_WhenSet()
    {
        var user = new User
        {
            AvatarUrl = "https://provider.com/avatar.jpg",
            CustomAvatarUrl = "sausage_classic",
        };

        Assert.Equal("sausage_classic", user.EffectiveAvatarUrl);
    }

    [Fact]
    public void EffectiveAvatarUrl_FallsBackToProvider_WhenCustomIsNull()
    {
        var user = new User
        {
            AvatarUrl = "https://provider.com/avatar.jpg",
            CustomAvatarUrl = null,
        };

        Assert.Equal("https://provider.com/avatar.jpg", user.EffectiveAvatarUrl);
    }

    [Fact]
    public void EffectiveAvatarUrl_ReturnsNull_WhenBothAreNull()
    {
        var user = new User
        {
            AvatarUrl = null,
            CustomAvatarUrl = null,
        };

        Assert.Null(user.EffectiveAvatarUrl);
    }
}
