using System.Security.Claims;
using BlunzigerChess.Api.Controllers;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Tests;

public class LobbyControllerAutopairTests
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
    public async Task CreateRoom_autopairs_when_matching_waiting_room_exists()
    {
        var hostId = Guid.NewGuid();
        var guestId = Guid.NewGuid();
        var matchConfig = """{"variant":"classic"}""";

        var (db, _) = CreateController(hostId);

        // Seed a waiting room from the host
        var host = new User { Id = hostId, DisplayName = "Alice" };
        db.Users.Add(host);
        var waitingRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "WAIT01",
            HostUserId = hostId,
            MatchConfig = matchConfig,
            Status = RoomStatus.Waiting,
            CreatedAt = DateTime.UtcNow,
        };
        db.MultiplayerRooms.Add(waitingRoom);
        await db.SaveChangesAsync();

        // Create a second controller for the guest user (same db)
        var guestController = new LobbyController(db);
        guestController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, guestId.ToString()),
                ], "test")),
            },
        };

        var result = await guestController.CreateRoom(new CreateRoomRequest { MatchConfig = matchConfig });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.True(doc.RootElement.GetProperty("paired").GetBoolean());
        Assert.Equal("WAIT01", doc.RootElement.GetProperty("code").GetString());
        Assert.Equal("Alice", doc.RootElement.GetProperty("hostDisplayName").GetString());

        // Room status should now be Playing
        var room = await db.MultiplayerRooms.FindAsync(waitingRoom.Id);
        Assert.Equal(RoomStatus.Playing, room!.Status);
        Assert.Equal(guestId, room.GuestUserId);
    }

    [Fact]
    public async Task CreateRoom_does_not_autopair_with_own_room()
    {
        var userId = Guid.NewGuid();
        var matchConfig = """{"variant":"classic"}""";

        var (db, controller) = CreateController(userId);

        // Seed a waiting room from the same user
        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "SELF01",
            HostUserId = userId,
            MatchConfig = matchConfig,
            Status = RoomStatus.Waiting,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var result = await controller.CreateRoom(new CreateRoomRequest { MatchConfig = matchConfig });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.False(doc.RootElement.GetProperty("paired").GetBoolean());
        // A new room was created, not the existing one
        Assert.NotEqual("SELF01", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CreateRoom_creates_new_room_when_no_matching_config()
    {
        var hostId = Guid.NewGuid();
        var guestId = Guid.NewGuid();

        var (db, _) = CreateController(hostId);

        // Seed a waiting room with a different config
        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "DIFF01",
            HostUserId = hostId,
            MatchConfig = """{"variant":"classic"}""",
            Status = RoomStatus.Waiting,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var guestController = new LobbyController(db);
        guestController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, guestId.ToString()),
                ], "test")),
            },
        };

        var result = await guestController.CreateRoom(new CreateRoomRequest { MatchConfig = """{"variant":"reverse"}""" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.False(doc.RootElement.GetProperty("paired").GetBoolean());
        Assert.NotEqual("DIFF01", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task CreateRoom_does_not_autopair_with_playing_room()
    {
        var hostId = Guid.NewGuid();
        var guestId = Guid.NewGuid();
        var matchConfig = """{"variant":"classic"}""";

        var (db, _) = CreateController(hostId);

        // Seed a room that is already Playing (not Waiting)
        db.MultiplayerRooms.Add(new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "PLAY01",
            HostUserId = hostId,
            GuestUserId = Guid.NewGuid(),
            MatchConfig = matchConfig,
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var guestController = new LobbyController(db);
        guestController.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, guestId.ToString()),
                ], "test")),
            },
        };

        var result = await guestController.CreateRoom(new CreateRoomRequest { MatchConfig = matchConfig });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(okResult.Value);
        var doc = System.Text.Json.JsonDocument.Parse(json);

        Assert.False(doc.RootElement.GetProperty("paired").GetBoolean());
        Assert.NotEqual("PLAY01", doc.RootElement.GetProperty("code").GetString());
    }
}
