using BlunzingerChess.Api.Data;
using BlunzingerChess.Api.Hubs;
using BlunzingerChess.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BlunzingerChess.Api.Services;

/// <summary>
/// Background service that periodically checks the matchmaking queue
/// and pairs players with compatible variant mode preferences.
/// </summary>
public class MatchmakingService(
    IServiceScopeFactory scopeFactory,
    IHubContext<GameHub> hubContext,
    ILogger<MatchmakingService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(3);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Matchmaking service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessQueueAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error processing matchmaking queue");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task ProcessQueueAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Get all queued entries, oldest first
        var entries = await db.MatchmakingQueue
            .Where(e => e.Status == MatchmakingStatus.Queued)
            .OrderBy(e => e.JoinedAt)
            .ToListAsync(ct);

        // Expire entries older than 5 minutes
        var expiryCutoff = DateTime.UtcNow.AddMinutes(-5);
        foreach (var old in entries.Where(e => e.JoinedAt < expiryCutoff))
        {
            old.Status = MatchmakingStatus.Expired;
            entries.Remove(old);
        }

        // Simple matching: pair consecutive entries (future: match by variant mode)
        var matched = new HashSet<Guid>();
        for (var i = 0; i < entries.Count; i++)
        {
            if (matched.Contains(entries[i].Id)) continue;

            for (var j = i + 1; j < entries.Count; j++)
            {
                if (matched.Contains(entries[j].Id)) continue;
                if (entries[i].UserId == entries[j].UserId) continue;

                // Match found — create room
                var room = new MultiplayerRoom
                {
                    Id = Guid.NewGuid(),
                    Code = GenerateRoomCode(),
                    HostUserId = entries[i].UserId,
                    GuestUserId = entries[j].UserId,
                    MatchConfig = entries[i].PreferredConfig,
                    Status = RoomStatus.Playing,
                    CreatedAt = DateTime.UtcNow,
                };

                db.MultiplayerRooms.Add(room);

                entries[i].Status = MatchmakingStatus.Matched;
                entries[i].RoomId = room.Id;
                entries[j].Status = MatchmakingStatus.Matched;
                entries[j].RoomId = room.Id;

                matched.Add(entries[i].Id);
                matched.Add(entries[j].Id);

                logger.LogInformation("Matched players {Player1} and {Player2} in room {Room}",
                    entries[i].UserId, entries[j].UserId, room.Code);

                // Notify both players via SignalR
                await hubContext.Clients.User(entries[i].UserId.ToString())
                    .SendAsync("MatchFound", new { roomId = room.Id, code = room.Code }, ct);
                await hubContext.Clients.User(entries[j].UserId.ToString())
                    .SendAsync("MatchFound", new { roomId = room.Id, code = room.Code }, ct);

                break;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static string GenerateRoomCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}
