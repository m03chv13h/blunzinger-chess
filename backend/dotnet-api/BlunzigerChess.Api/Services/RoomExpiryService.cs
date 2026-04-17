using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.Hubs;
using BlunzigerChess.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Services;

/// <summary>
/// Background service that periodically cancels multiplayer rooms
/// still in <see cref="RoomStatus.Waiting"/> after the lobby timeout.
/// This acts as a server-side safety net in case the frontend countdown
/// fails to cancel the room (e.g. browser crash, network loss).
/// </summary>
public class RoomExpiryService(
    IServiceScopeFactory scopeFactory,
    IHubContext<GameHub> hubContext,
    ILogger<RoomExpiryService> logger) : BackgroundService
{
    /// <summary>How often the background loop checks for stale rooms.</summary>
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(10);

    /// <summary>Rooms waiting longer than this are cancelled.</summary>
    private static readonly TimeSpan RoomTimeout = TimeSpan.FromSeconds(60);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Room expiry service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExpireStaleRoomsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error expiring stale rooms");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    internal async Task ExpireStaleRoomsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoff = DateTime.UtcNow - RoomTimeout;

        var staleRooms = await db.MultiplayerRooms
            .Where(r => r.Status == RoomStatus.Waiting && r.CreatedAt < cutoff)
            .ToListAsync(ct);

        foreach (var room in staleRooms)
        {
            room.Status = RoomStatus.Cancelled;

            // Notify any connected host that the room has been closed
            await hubContext.Clients
                .Group($"room_{room.Code}")
                .SendAsync("RoomExpired", new
                {
                    roomCode = room.Code,
                    reason = "No opponent joined within the time limit",
                }, cancellationToken: ct);

            logger.LogInformation("Expired waiting room {Room} (created {CreatedAt})",
                room.Code, room.CreatedAt);
        }

        if (staleRooms.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
