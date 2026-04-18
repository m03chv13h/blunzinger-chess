using System.Security.Claims;
using BlunzigerChess.Api.Controllers;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Tests;

public class LobbyControllerGetActiveRoomTests
{
    private static (AppDbContext db, LobbyController controller) CreateController(Guid userId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var controller = new LobbyController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                ], "test")),
            },
        };

        return (db, controller);
    }

    [Fact]
    public async Task GetActiveRoom_returns_active_when_playing_room_exists()
    {
        var hostId = Guid.NewGuid();
        var guestId = Guid.NewGuid();
        var (db, controller) = CreateController(hostId);

        var host = new User { Id = hostId, DisplayName = "Alice" };
        var guest = new User { Id = guestId, DisplayName = "Bob" };
        db.Users.AddRange(host, guest);

        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "PLAY01",
            HostUserId = hostId,
            GuestUserId = guestId,
            MatchConfig = """{"variant":"classic"}""",
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await controller.GetActiveRoom();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.True(doc.RootElement.GetProperty("active").GetBoolean());
        Assert.Equal("PLAY01", doc.RootElement.GetProperty("roomCode").GetString());
        Assert.Equal("w", doc.RootElement.GetProperty("playerColor").GetString());
        Assert.Equal("Bob", doc.RootElement.GetProperty("opponentName").GetString());
    }

    [Fact]
    public async Task GetActiveRoom_returns_inactive_when_room_is_finished()
    {
        var hostId = Guid.NewGuid();
        var guestId = Guid.NewGuid();
        var (db, controller) = CreateController(hostId);

        db.Users.AddRange(
            new User { Id = hostId, DisplayName = "Alice" },
            new User { Id = guestId, DisplayName = "Bob" });

        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "DONE01",
            HostUserId = hostId,
            GuestUserId = guestId,
            MatchConfig = """{"variant":"classic"}""",
            Status = RoomStatus.Finished,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await controller.GetActiveRoom();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.False(doc.RootElement.GetProperty("active").GetBoolean());
    }

    [Fact]
    public async Task GetActiveRoom_returns_inactive_when_no_rooms_exist()
    {
        var userId = Guid.NewGuid();
        var (_, controller) = CreateController(userId);

        var result = await controller.GetActiveRoom();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.False(doc.RootElement.GetProperty("active").GetBoolean());
    }

    [Fact]
    public async Task GetActiveRoom_skips_finished_and_returns_playing()
    {
        var hostId = Guid.NewGuid();
        var guestId = Guid.NewGuid();
        var (db, controller) = CreateController(hostId);

        db.Users.AddRange(
            new User { Id = hostId, DisplayName = "Alice" },
            new User { Id = guestId, DisplayName = "Bob" });

        // Older finished room
        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "OLD01",
            HostUserId = hostId,
            GuestUserId = guestId,
            MatchConfig = """{"variant":"classic"}""",
            Status = RoomStatus.Finished,
            CreatedAt = DateTime.UtcNow.AddHours(-1),
        });

        // Newer playing room
        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "NEW01",
            HostUserId = hostId,
            GuestUserId = guestId,
            MatchConfig = """{"variant":"classic"}""",
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await controller.GetActiveRoom();

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.True(doc.RootElement.GetProperty("active").GetBoolean());
        Assert.Equal("NEW01", doc.RootElement.GetProperty("roomCode").GetString());
    }
}
