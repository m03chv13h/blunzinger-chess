using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.Hubs;
using BlunzigerChess.Api.Models;
using BlunzigerChess.Api.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace BlunzigerChess.Api.Tests;

public class RoomExpiryServiceTests
{
    private static (AppDbContext db, RoomExpiryService service) CreateTestService()
    {
        // In-memory database
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        // Build a real IServiceScopeFactory that resolves the same in-memory db
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o =>
            o.UseInMemoryDatabase(db.Database.GetConnectionString()!));

        // We need to re-register with the same in-memory store.
        // Instead, use a factory that returns our existing db.
        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        var scope = Substitute.For<IServiceScope>();
        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(typeof(AppDbContext)).Returns(db);
        scope.ServiceProvider.Returns(serviceProvider);
        scopeFactory.CreateScope().Returns(scope);

        var hubContext = Substitute.For<IHubContext<GameHub>>();
        var clients = Substitute.For<IHubClients>();
        var clientProxy = Substitute.For<IClientProxy>();
        clients.Group(Arg.Any<string>()).Returns(clientProxy);
        hubContext.Clients.Returns(clients);

        var logger = NullLogger<RoomExpiryService>.Instance;

        var service = new RoomExpiryService(scopeFactory, hubContext, logger);
        return (db, service);
    }

    [Fact]
    public async Task Cancels_rooms_waiting_longer_than_60_seconds()
    {
        var (db, service) = CreateTestService();

        var staleRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "STALE1",
            HostUserId = Guid.NewGuid(),
            Status = RoomStatus.Waiting,
            CreatedAt = DateTime.UtcNow.AddSeconds(-90), // 90s ago — should expire
        };
        db.MultiplayerRooms.Add(staleRoom);
        await db.SaveChangesAsync();

        await service.ExpireStaleRoomsAsync(CancellationToken.None);

        var room = await db.MultiplayerRooms.FindAsync(staleRoom.Id);
        Assert.Equal(RoomStatus.Cancelled, room!.Status);
    }

    [Fact]
    public async Task Does_not_cancel_recent_waiting_rooms()
    {
        var (db, service) = CreateTestService();

        var recentRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "FRESH1",
            HostUserId = Guid.NewGuid(),
            Status = RoomStatus.Waiting,
            CreatedAt = DateTime.UtcNow.AddSeconds(-30), // 30s ago — still within timeout
        };
        db.MultiplayerRooms.Add(recentRoom);
        await db.SaveChangesAsync();

        await service.ExpireStaleRoomsAsync(CancellationToken.None);

        var room = await db.MultiplayerRooms.FindAsync(recentRoom.Id);
        Assert.Equal(RoomStatus.Waiting, room!.Status);
    }

    [Fact]
    public async Task Does_not_cancel_rooms_already_playing()
    {
        var (db, service) = CreateTestService();

        var playingRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "PLAY01",
            HostUserId = Guid.NewGuid(),
            GuestUserId = Guid.NewGuid(),
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow.AddSeconds(-120), // old but recently active
            LastActivityAt = DateTime.UtcNow.AddSeconds(-30),
        };
        db.MultiplayerRooms.Add(playingRoom);
        await db.SaveChangesAsync();

        await service.ExpireStaleRoomsAsync(CancellationToken.None);

        var room = await db.MultiplayerRooms.FindAsync(playingRoom.Id);
        Assert.Equal(RoomStatus.Playing, room!.Status);
    }

    [Fact]
    public async Task Marks_abandoned_playing_rooms_as_finished()
    {
        var (db, service) = CreateTestService();

        var abandonedRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "ABAN01",
            HostUserId = Guid.NewGuid(),
            GuestUserId = Guid.NewGuid(),
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow.AddHours(-3),
            LastActivityAt = DateTime.UtcNow.AddHours(-2), // inactive for 2 hours
        };
        db.MultiplayerRooms.Add(abandonedRoom);
        await db.SaveChangesAsync();

        await service.ExpireStaleRoomsAsync(CancellationToken.None);

        var room = await db.MultiplayerRooms.FindAsync(abandonedRoom.Id);
        Assert.Equal(RoomStatus.Finished, room!.Status);
    }

    [Fact]
    public async Task Marks_abandoned_playing_rooms_without_last_activity_as_finished()
    {
        var (db, service) = CreateTestService();

        // Room created long ago with no LastActivityAt — falls back to CreatedAt
        var abandonedRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "ABAN02",
            HostUserId = Guid.NewGuid(),
            GuestUserId = Guid.NewGuid(),
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow.AddHours(-3),
            LastActivityAt = null,
        };
        db.MultiplayerRooms.Add(abandonedRoom);
        await db.SaveChangesAsync();

        await service.ExpireStaleRoomsAsync(CancellationToken.None);

        var room = await db.MultiplayerRooms.FindAsync(abandonedRoom.Id);
        Assert.Equal(RoomStatus.Finished, room!.Status);
    }

    [Fact]
    public async Task Does_not_expire_recently_active_playing_rooms()
    {
        var (db, service) = CreateTestService();

        var activeRoom = new MultiplayerRoom
        {
            Id = Guid.NewGuid(),
            Code = "ACTV01",
            HostUserId = Guid.NewGuid(),
            GuestUserId = Guid.NewGuid(),
            Status = RoomStatus.Playing,
            CreatedAt = DateTime.UtcNow.AddHours(-5), // created 5 hours ago
            LastActivityAt = DateTime.UtcNow.AddMinutes(-10), // but active 10 min ago
        };
        db.MultiplayerRooms.Add(activeRoom);
        await db.SaveChangesAsync();

        await service.ExpireStaleRoomsAsync(CancellationToken.None);

        var room = await db.MultiplayerRooms.FindAsync(activeRoom.Id);
        Assert.Equal(RoomStatus.Playing, room!.Status);
    }
}
