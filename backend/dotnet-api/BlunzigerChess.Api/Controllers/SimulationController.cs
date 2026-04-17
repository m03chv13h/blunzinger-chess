using System.Text.Json;
using BlunzigerChess.Api.GrpcClients;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlunzigerChess.Api.Controllers;

/// <summary>
/// Simulation endpoints — runs bot-vs-bot games on the backend Node worker
/// so the browser doesn't have to execute them client-side.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SimulationController(GameEngineClient engineClient) : ControllerBase
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
}
