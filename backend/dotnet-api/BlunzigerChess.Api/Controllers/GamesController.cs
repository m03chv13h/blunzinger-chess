using System.Security.Claims;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlunzigerChess.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GamesController(AppDbContext db) : ControllerBase
{
    /// <summary>Save a completed game.</summary>
    [HttpPost]
    public async Task<IActionResult> SaveGame([FromBody] SaveGameRequest request)
    {
        var userId = GetUserId();

        var game = new Game
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            MatchConfig = request.MatchConfig,
            GameStateJson = request.GameState,
            Result = request.Result,
            Scores = request.Scores,
            PositionHistory = request.PositionHistory,
            MoveHistory = request.MoveHistory,
            FinalFen = request.FinalFen,
            MoveCount = request.MoveCount,
            GameMode = request.GameMode ?? "local",
            CreatedAt = DateTime.UtcNow,
            CompletedAt = DateTime.UtcNow,
        };

        db.Games.Add(game);
        await db.SaveChangesAsync();

        return Ok(new { gameId = game.Id });
    }

    /// <summary>List the authenticated user's games.</summary>
    [HttpGet]
    public async Task<IActionResult> ListGames(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetUserId();
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = db.Games
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.CompletedAt ?? g.CreatedAt);

        var total = await query.CountAsync();
        var games = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(g => new
            {
                g.Id,
                g.MatchConfig,
                g.Result,
                g.FinalFen,
                g.MoveCount,
                g.GameMode,
                g.CreatedAt,
                g.CompletedAt,
            })
            .ToListAsync();

        return Ok(new { games, total, page, pageSize });
    }

    /// <summary>Get a specific game by ID.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetGame(Guid id)
    {
        var userId = GetUserId();

        var game = await db.Games
            .Where(g => g.Id == id && g.UserId == userId)
            .FirstOrDefaultAsync();

        if (game is null)
            return NotFound();

        return Ok(game);
    }

    private Guid? GetUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
    }
}

public record SaveGameRequest
{
    public required string MatchConfig { get; init; }
    public string? GameState { get; init; }
    public string? Result { get; init; }
    public string? Scores { get; init; }
    public string? PositionHistory { get; init; }
    public string? MoveHistory { get; init; }
    public string? FinalFen { get; init; }
    public int MoveCount { get; init; }
    public string? GameMode { get; init; }
}
