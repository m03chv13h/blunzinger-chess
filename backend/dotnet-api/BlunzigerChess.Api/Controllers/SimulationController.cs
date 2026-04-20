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
    /// Run a batch of simulated bot-vs-bot games, save results to DB, and return
    /// the simulation record (config, standings, all game records).
    /// </summary>
    [HttpPost("run-batch")]
    public async Task<ContentResult> RunBatch([FromBody] RunBatchRequest request)
    {
        var userId = GetUserId();
        var count = Math.Clamp(request.Count, 1, 200);
        var configJson = request.Config.GetRawText();

        // Run all games on the Node worker
        var recordsJson = await engineClient.RunBatchSimulationJsonAsync(configJson, count);

        // Parse records to compute standings
        using var doc = JsonDocument.Parse(recordsJson);
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

        // Persist to database
        var simulation = new Simulation
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ConfigJson = configJson,
            GameCount = count,
            WhiteWins = whiteWins,
            BlackWins = blackWins,
            Draws = draws,
            GamesJson = recordsJson,
            CreatedAt = DateTime.UtcNow,
            CompletedAt = DateTime.UtcNow,
        };
        db.Simulations.Add(simulation);
        await db.SaveChangesAsync();

        // Build response matching the frontend SimulationRecord shape
        var responseJson = JsonSerializer.Serialize(new
        {
            id = simulation.Id.ToString(),
            completedAt = new DateTimeOffset(simulation.CompletedAt!.Value).ToUnixTimeMilliseconds(),
            config = JsonSerializer.Deserialize<JsonElement>(configJson),
            games = JsonSerializer.Deserialize<JsonElement>(recordsJson),
            standing = new { whiteWins, blackWins, draws },
        });

        return Content(responseJson, "application/json");
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
                s.WhiteWins,
                s.BlackWins,
                s.Draws,
                s.CreatedAt,
                s.CompletedAt,
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
        var responseJson = JsonSerializer.Serialize(new
        {
            id = simulation.Id.ToString(),
            completedAt = new DateTimeOffset(simulation.CompletedAt ?? simulation.CreatedAt).ToUnixTimeMilliseconds(),
            config = JsonSerializer.Deserialize<JsonElement>(simulation.ConfigJson),
            games = JsonSerializer.Deserialize<JsonElement>(simulation.GamesJson),
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
