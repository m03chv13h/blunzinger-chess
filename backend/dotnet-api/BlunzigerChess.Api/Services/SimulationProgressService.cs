using System.Text.Json;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.GrpcClients;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Services;

/// <summary>
/// Background service that polls the Node worker for simulation progress
/// and persists completed game results to the database.
/// This ensures game results are saved even if the frontend disconnects.
/// </summary>
public class SimulationProgressService(
    IServiceScopeFactory scopeFactory,
    ILogger<SimulationProgressService> logger) : BackgroundService
{
    /// <summary>
    /// How often the background loop polls for simulation progress.
    /// Intentionally slightly faster than the frontend's 4-second polling
    /// interval so DB results are fresh when the frontend requests them.
    /// </summary>
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(3);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Simulation progress service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncSimulationProgressAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Error syncing simulation progress");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    internal async Task SyncSimulationProgressAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var engineClient = scope.ServiceProvider.GetRequiredService<GameEngineClient>();

        // Find all pending (not completed) simulations
        var pendingSimulations = await db.Simulations
            .Where(s => s.CompletedAt == null)
            .ToListAsync(ct);

        if (pendingSimulations.Count == 0)
            return;

        foreach (var simulation in pendingSimulations)
        {
            try
            {
                var progress = await engineClient.GetSimulationProgressAsync(simulation.Id.ToString());

                if (progress.CompletedGames <= simulation.CompletedGames)
                    continue;

                // Parse new game records and compute updated standings
                using var doc = JsonDocument.Parse(progress.CompletedRecordsJson);
                var records = doc.RootElement;
                int whiteWins = 0, blackWins = 0, draws = 0;
                foreach (var record in records.EnumerateArray())
                {
                    if (record.TryGetProperty("result", out var result) &&
                        result.TryGetProperty("winner", out var winner))
                    {
                        var w = winner.GetString();
                        if (w == "w") whiteWins++;
                        else if (w == "b") blackWins++;
                        else draws++;
                    }
                }

                // Update the simulation record
                simulation.CompletedGames = progress.CompletedGames;
                simulation.GamesJson = progress.CompletedRecordsJson;
                simulation.WhiteWins = whiteWins;
                simulation.BlackWins = blackWins;
                simulation.Draws = draws;

                if (progress.Finished)
                {
                    simulation.CompletedAt = DateTime.UtcNow;
                    logger.LogInformation(
                        "Simulation {SimId} completed: {Count} games ({W}W/{B}B/{D}D)",
                        simulation.Id, simulation.GameCount, whiteWins, blackWins, draws);
                }

                await db.SaveChangesAsync(ct);
            }
            catch (Grpc.Core.RpcException ex) when (ex.StatusCode == Grpc.Core.StatusCode.NotFound)
            {
                // Worker no longer knows about this simulation (cleaned up after
                // the grace period). If the simulation was never completed, it may
                // have been lost — log and skip.
                logger.LogDebug(
                    "Simulation {SimId} not found on worker (may have been cleaned up)",
                    simulation.Id);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Error polling progress for simulation {SimId}", simulation.Id);
            }
        }
    }
}
