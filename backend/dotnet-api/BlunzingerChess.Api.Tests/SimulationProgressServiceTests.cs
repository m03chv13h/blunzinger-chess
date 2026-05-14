using BlunzingerChess.Api.Data;
using BlunzingerChess.Api.GrpcClients;
using BlunzingerChess.Api.Models;
using BlunzingerChess.Api.Services;
using BlunzingerChess.Proto;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace BlunzingerChess.Api.Tests;

public class SimulationProgressServiceTests
{
    private static (AppDbContext db, SimulationProgressService service, GameEngineClient engineClient)
        CreateTestService()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var scopeFactory = Substitute.For<IServiceScopeFactory>();
        var scope = Substitute.For<IServiceScope>();
        var serviceProvider = Substitute.For<IServiceProvider>();
        serviceProvider.GetService(typeof(AppDbContext)).Returns(db);

        // Mock GameEngineClient — need to provide mocked gRPC clients
        var simClient = Substitute.For<SimulationService.SimulationServiceClient>();
        var engineClient = new GameEngineClient(
            Substitute.For<GameLogicService.GameLogicServiceClient>(),
            Substitute.For<BotService.BotServiceClient>(),
            Substitute.For<EvaluationService.EvaluationServiceClient>(),
            simClient);

        serviceProvider.GetService(typeof(GameEngineClient)).Returns(engineClient);
        scope.ServiceProvider.Returns(serviceProvider);
        scopeFactory.CreateScope().Returns(scope);

        var logger = NullLogger<SimulationProgressService>.Instance;
        var service = new SimulationProgressService(scopeFactory, logger);

        return (db, service, engineClient);
    }

    [Fact]
    public async Task Marks_stale_simulations_as_completed()
    {
        var (db, service, _) = CreateTestService();

        var staleSimulation = new Simulation
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            ConfigJson = "{}",
            GameCount = 10,
            CompletedGames = 3,
            GamesJson = "[]",
            WhiteWins = 2,
            BlackWins = 1,
            Draws = 0,
            CreatedAt = DateTime.UtcNow.AddHours(-2), // 2 hours ago — past the 1-hour timeout
            CompletedAt = null,
        };
        db.Simulations.Add(staleSimulation);
        await db.SaveChangesAsync();

        await service.SyncSimulationProgressAsync(CancellationToken.None);

        var sim = await db.Simulations.FindAsync(staleSimulation.Id);
        Assert.NotNull(sim!.CompletedAt);
        // Partial results should be preserved
        Assert.Equal(3, sim.CompletedGames);
        Assert.Equal(2, sim.WhiteWins);
    }

    [Fact]
    public async Task Does_not_mark_recent_simulations_as_stale()
    {
        var (db, service, _) = CreateTestService();

        var recentSimulation = new Simulation
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            ConfigJson = "{}",
            GameCount = 10,
            CompletedGames = 0,
            GamesJson = "[]",
            CreatedAt = DateTime.UtcNow.AddMinutes(-5), // Only 5 minutes ago
            CompletedAt = null,
        };
        db.Simulations.Add(recentSimulation);
        await db.SaveChangesAsync();

        // The gRPC call will throw because the mock isn't configured for this simulation.
        // That's expected — it falls into the general catch block.
        await service.SyncSimulationProgressAsync(CancellationToken.None);

        var sim = await db.Simulations.FindAsync(recentSimulation.Id);
        Assert.Null(sim!.CompletedAt); // Should still be pending
    }

    [Fact]
    public async Task Does_not_touch_already_completed_simulations()
    {
        var (db, service, _) = CreateTestService();

        var completedSimulation = new Simulation
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            ConfigJson = "{}",
            GameCount = 5,
            CompletedGames = 5,
            GamesJson = "[]",
            CreatedAt = DateTime.UtcNow.AddHours(-3),
            CompletedAt = DateTime.UtcNow.AddHours(-2),
        };
        db.Simulations.Add(completedSimulation);
        await db.SaveChangesAsync();

        await service.SyncSimulationProgressAsync(CancellationToken.None);

        var sim = await db.Simulations.FindAsync(completedSimulation.Id);
        // CompletedAt should remain unchanged
        Assert.Equal(completedSimulation.CompletedAt, sim!.CompletedAt);
    }
}
