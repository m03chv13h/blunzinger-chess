using System.Security.Claims;
using System.Text.Json;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.GrpcClients;
using BlunzigerChess.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Controllers;

/// <summary>
/// Simulation endpoints — runs bot-vs-bot games on the backend Node worker
/// so the browser doesn't have to execute them client-side.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SimulationController(GameEngineClient engineClient, AppDbContext db) : ControllerBase
{
    /// <summary>
    /// Run a single simulated bot-vs-bot game and return the game record.
    /// The request body is the GameSetupConfig JSON (frontend format).
    /// </summary>
    [HttpPost("run")]
    public async Task<ContentResult> RunGame([FromBody] JsonElement config)
    {
        var configJson = config.GetRawText();
        var recordJson = await engineClient.RunSimulatedGameJsonAsync(configJson);
        return Content(recordJson, "application/json");
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

        // Enqueue the batch on the worker — returns immediately
        await engineClient.EnqueueBatchSimulationAsync(
            simulation.Id.ToString(), configJson, count);

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
            var completedStatus = simulation.CompletedGames >= simulation.GameCount
                ? "completed" : "abandoned";
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
        var simStatus = simulation.CompletedAt.HasValue
            ? (simulation.CompletedGames >= simulation.GameCount ? "completed" : "abandoned")
            : "running";
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
}

public record RunBatchRequest
{
    public required JsonElement Config { get; init; }
    public int Count { get; init; }
}
