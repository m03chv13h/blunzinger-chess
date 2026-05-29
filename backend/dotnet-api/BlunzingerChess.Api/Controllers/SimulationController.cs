using System.Security.Claims;
using System.Text.Json;
using BlunzingerChess.Api.Data;
using BlunzingerChess.Api.GrpcClients;
using BlunzingerChess.Api.Models;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzingerChess.Api.Controllers;

/// <summary>
/// Simulation endpoints — runs bot-vs-bot games on the backend Node worker
/// so the browser doesn't have to execute them client-side.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SimulationController(
    GameEngineClient engineClient,
    AppDbContext db,
    IConfiguration configuration,
    IHttpClientFactory httpClientFactory,
    ILogger<SimulationController> logger) : ControllerBase
{
    /// <summary>
    /// Check whether the simulation worker is up and reachable.
    /// This also wakes the worker if it is sleeping (Render free plan).
    /// </summary>
    [HttpGet("worker-status")]
    [AllowAnonymous]
    public async Task<IActionResult> GetWorkerStatus()
    {
        // On Render's free plan, sleeping services only wake on external HTTP
        // requests to their public URL.  Await the wake request so the worker
        // has a chance to start up before we attempt the gRPC ping.
        await TryWakeWorkerAsync();

        try
        {
            await engineClient.PingWorkerAsync();
            return Ok(new { status = "ready" });
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Worker ping failed");
            return Ok(new { status = "unavailable" });
        }
    }

    /// <summary>
    /// Fire-and-forget HTTP GET to the worker's public URL to wake it from
    /// Render free-plan sleep.  Failures are silently ignored.
    /// </summary>
    private async Task TryWakeWorkerAsync()
    {
        var externalUrl = configuration["NodeWorker:ExternalUrl"];
        if (string.IsNullOrWhiteSpace(externalUrl))
            return;

        try
        {
            using var client = httpClientFactory.CreateClient("WorkerWake");
            client.Timeout = TimeSpan.FromSeconds(5);
            await client.GetAsync(externalUrl);
        }
        catch
        {
            // Best-effort — ignore all failures
        }
    }

    /// <summary>
    /// Run a single simulated bot-vs-bot game and return the game record.
    /// The request body is the GameSetupConfig JSON (frontend format).
    /// </summary>
    [HttpPost("run")]
    public async Task<IActionResult> RunGame([FromBody] JsonElement config)
    {
        try
        {
            var configJson = config.GetRawText();
            var recordJson = await engineClient.RunSimulatedGameJsonAsync(configJson);
            return Content(recordJson, "application/json");
        }
        catch (RpcException ex)
        {
            return StatusCode(503, new { error = "Simulation worker is unavailable. Please try again shortly.", detail = ex.Status.Detail });
        }
    }

    /// <summary>
    /// Run a batch of simulated bot-vs-bot games asynchronously.
    /// Creates the simulation record, enqueues the games on the Node worker,
    /// and returns immediately with the simulation ID.
    /// The worker processes each game individually from its queue.
    /// </summary>
    [HttpPost("run-batch")]
    public async Task<IActionResult> RunBatch([FromBody] RunBatchRequest request)
    {
        var userId = GetUserId();
        var count = Math.Clamp(request.Count, 1, 200);
        var configJson = request.Config.GetRawText();

        // Create the simulation record in pending state
        var simulation = new Simulation
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ConfigJson = configJson,
            GameCount = count,
            WhiteWins = 0,
            BlackWins = 0,
            Draws = 0,
            CompletedGames = 0,
            GamesJson = "[]",
            CreatedAt = DateTime.UtcNow,
            CompletedAt = null,
        };
        db.Simulations.Add(simulation);
        await db.SaveChangesAsync();

        try
        {
            // Enqueue the batch on the worker — returns immediately
            await engineClient.EnqueueBatchSimulationAsync(
                simulation.Id.ToString(), configJson, count);
        }
        catch (RpcException ex)
        {
            // Worker unreachable — mark the simulation as abandoned so it doesn't
            // stay in "running" state forever, and return a clear error to the client.
            simulation.CompletedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return StatusCode(503, new { error = "Simulation worker is unavailable. Please try again shortly.", detail = ex.Status.Detail });
        }

        return Ok(new
        {
            id = simulation.Id.ToString(),
            status = "running",
            gameCount = count,
            completedGames = 0,
        });
    }

    /// <summary>
    /// Get the current status/progress of a simulation.
    /// Used by the frontend to poll for updates during async simulations.
    /// </summary>
    [HttpGet("{id:guid}/status")]
    public async Task<IActionResult> GetSimulationStatus(Guid id)
    {
        var userId = GetUserId();

        var simulation = await db.Simulations
            .Where(s => s.Id == id && s.UserId == userId)
            .FirstOrDefaultAsync();

        if (simulation is null)
            return NotFound();

        // Already completed — return the full result from DB
        if (simulation.CompletedAt.HasValue)
        {
            var completedStatus = DeriveStatus(simulation);
            var responseJson = JsonSerializer.Serialize(new
            {
                id = simulation.Id.ToString(),
                status = completedStatus,
                completedAt = new DateTimeOffset(simulation.CompletedAt.Value).ToUnixTimeMilliseconds(),
                config = JsonSerializer.Deserialize<JsonElement>(simulation.ConfigJson),
                games = JsonSerializer.Deserialize<JsonElement>(simulation.GamesJson),
                gameCount = simulation.GameCount,
                completedGames = simulation.CompletedGames,
                standing = new
                {
                    whiteWins = simulation.WhiteWins,
                    blackWins = simulation.BlackWins,
                    draws = simulation.Draws,
                },
            });
            return Content(responseJson, "application/json");
        }

        // Still running — return what we have so far
        var statusJson = JsonSerializer.Serialize(new
        {
            id = simulation.Id.ToString(),
            status = "running",
            config = JsonSerializer.Deserialize<JsonElement>(simulation.ConfigJson),
            games = JsonSerializer.Deserialize<JsonElement>(simulation.GamesJson),
            gameCount = simulation.GameCount,
            completedGames = simulation.CompletedGames,
            standing = new
            {
                whiteWins = simulation.WhiteWins,
                blackWins = simulation.BlackWins,
                draws = simulation.Draws,
            },
        });
        return Content(statusJson, "application/json");
    }

    /// <summary>List the authenticated user's simulations (paginated, without full game data).</summary>
    [HttpGet]
    public async Task<IActionResult> ListSimulations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetUserId();
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = db.Simulations
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CompletedAt ?? s.CreatedAt);

        var total = await query.CountAsync();
        var simulations = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                s.ConfigJson,
                s.GameCount,
                s.CompletedGames,
                s.WhiteWins,
                s.BlackWins,
                s.Draws,
                s.CreatedAt,
                s.CompletedAt,
                Status = s.CompletedAt.HasValue
                    ? (s.CompletedGames >= s.GameCount ? "completed" : "abandoned")
                    : "running",
            })
            .ToListAsync();

        return Ok(new { simulations, total, page, pageSize });
    }

    /// <summary>Get a specific simulation by ID (includes all game records).</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetSimulation(Guid id)
    {
        var userId = GetUserId();

        var simulation = await db.Simulations
            .Where(s => s.Id == id && s.UserId == userId)
            .FirstOrDefaultAsync();

        if (simulation is null)
            return NotFound();

        // Return in SimulationRecord shape
        var simStatus = DeriveStatus(simulation);
        var responseJson = JsonSerializer.Serialize(new
        {
            id = simulation.Id.ToString(),
            status = simStatus,
            completedAt = simulation.CompletedAt.HasValue
                ? new DateTimeOffset(simulation.CompletedAt.Value).ToUnixTimeMilliseconds()
                : (long?)null,
            config = JsonSerializer.Deserialize<JsonElement>(simulation.ConfigJson),
            games = JsonSerializer.Deserialize<JsonElement>(simulation.GamesJson),
            gameCount = simulation.GameCount,
            completedGames = simulation.CompletedGames,
            standing = new
            {
                whiteWins = simulation.WhiteWins,
                blackWins = simulation.BlackWins,
                draws = simulation.Draws,
            },
        });

        return Content(responseJson, "application/json");
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
    }

    private static string DeriveStatus(Simulation simulation) =>
        simulation.CompletedAt.HasValue
            ? (simulation.CompletedGames >= simulation.GameCount ? "completed" : "abandoned")
            : "running";
}

public record RunBatchRequest
{
    public required JsonElement Config { get; init; }
    public int Count { get; init; }
}
