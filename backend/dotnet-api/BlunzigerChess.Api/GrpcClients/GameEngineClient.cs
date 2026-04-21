using BlunzigerChess.Proto;

namespace BlunzigerChess.Api.GrpcClients;

/// <summary>
/// Typed wrapper around gRPC clients to the Node.js game engine worker.
/// Provides a clean interface for the rest of the .NET API to call game logic.
/// </summary>
public class GameEngineClient(
    GameLogicService.GameLogicServiceClient gameLogic,
    BotService.BotServiceClient bot,
    EvaluationService.EvaluationServiceClient evaluation,
    SimulationService.SimulationServiceClient simulation)
{
    // ── Game Logic ───────────────────────────────────────────────────

    public async Task<GameState> CreateInitialStateAsync(GameSetupConfig config)
    {
        var response = await gameLogic.CreateInitialStateAsync(
            new CreateInitialStateRequest { Config = config });
        return response.State;
    }

    public async Task<GameState> ApplyMoveAsync(GameState state, ChessMove move)
    {
        var response = await gameLogic.ApplyMoveWithRulesAsync(
            new ApplyMoveRequest { State = state, Move = move });
        return response.State;
    }

    public async Task<GameState> ApplyDropMoveAsync(GameState state, DropMove drop)
    {
        var response = await gameLogic.ApplyDropMoveWithRulesAsync(
            new ApplyDropMoveRequest { State = state, Drop = drop });
        return response.State;
    }

    public async Task<GameState> ApplyPieceRemovalAsync(GameState state, string square)
    {
        var response = await gameLogic.ApplyPieceRemovalAsync(
            new ApplyPieceRemovalRequest { State = state, Square = square });
        return response.State;
    }

    public async Task<GameState> ReportViolationAsync(GameState state, Color reportingSide)
    {
        var response = await gameLogic.ReportViolationAsync(
            new ReportViolationRequest { State = state, ReportingSide = reportingSide });
        return response.State;
    }

    public async Task<bool> CanReportAsync(GameState state, Color side)
    {
        var response = await gameLogic.CanReportAsync(
            new CanReportRequest { State = state, Side = side });
        return response.CanReport;
    }

    public async Task<GameState> ApplyTimeoutAsync(GameState state, Color losingSide)
    {
        var response = await gameLogic.ApplyTimeoutAsync(
            new ApplyTimeoutRequest { State = state, LosingSide = losingSide });
        return response.State;
    }

    // ── Bot ──────────────────────────────────────────────────────────

    public async Task<ChessMove?> SelectBotMoveAsync(string fen, BotLevel level, MatchConfig? config = null)
    {
        var request = new SelectBotMoveRequest { Fen = fen, Level = level };
        if (config is not null) request.Config = config;
        var response = await bot.SelectBotMoveAsync(request);
        return response.Move;
    }

    public async Task<bool> ShouldBotReportAsync(BotLevel level, ViolationRecord violation)
    {
        var response = await bot.ShouldBotReportAsync(
            new ShouldBotReportRequest { Level = level, Violation = violation });
        return response.ShouldReport;
    }

    // ── Evaluation ───────────────────────────────────────────────────

    public async Task<EvaluationResult> EvaluateGameStateAsync(GameState state, long whiteMs, long blackMs)
    {
        var response = await evaluation.EvaluateGameStateAsync(
            new EvaluateGameStateRequest { State = state, WhiteMs = whiteMs, BlackMs = blackMs });
        return response.Result;
    }

    // ── Simulation ───────────────────────────────────────────────────

    public async Task<GameRecord> RunSimulatedGameAsync(GameSetupConfig config)
    {
        var response = await simulation.RunSimulatedGameAsync(
            new RunSimulatedGameRequest { Config = config });
        return response.Record;
    }

    /// <summary>
    /// JSON passthrough variant — sends the frontend config JSON directly to the
    /// Node worker and returns the result JSON without proto enum mapping.
    /// </summary>
    public async Task<string> RunSimulatedGameJsonAsync(string configJson)
    {
        var response = await simulation.RunSimulatedGameJsonAsync(
            new RunSimulatedGameJsonRequest { ConfigJson = configJson });
        return response.RecordJson;
    }

    /// <summary>
    /// Batch JSON variant — runs N games on the Node worker and returns all
    /// game records as a JSON array string.
    /// </summary>
    public async Task<string> RunBatchSimulationJsonAsync(string configJson, int count)
    {
        var response = await simulation.RunBatchSimulationJsonAsync(
            new RunBatchSimulationJsonRequest { ConfigJson = configJson, Count = count });
        return response.RecordsJson;
    }

    /// <summary>
    /// Enqueue a batch of games for async processing on the Node worker.
    /// Returns immediately after the worker has placed each game into its queue.
    /// </summary>
    public async Task EnqueueBatchSimulationAsync(string simulationId, string configJson, int count)
    {
        await simulation.EnqueueBatchSimulationAsync(
            new EnqueueBatchRequest { SimulationId = simulationId, ConfigJson = configJson, Count = count });
    }

    /// <summary>
    /// Query the progress of a previously enqueued batch simulation.
    /// </summary>
    public async Task<GetSimulationProgressResponse> GetSimulationProgressAsync(string simulationId)
    {
        return await simulation.GetSimulationProgressAsync(
            new GetSimulationProgressRequest { SimulationId = simulationId });
    }
}
