var builder = DistributedApplication.CreateBuilder(args);

// ── PostgreSQL ───────────────────────────────────────────────────────

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("blunzinger-chess-pgdata");

var database = postgres.AddDatabase("blunzinger-chess");

// ── Node.js Game Engine Worker ───────────────────────────────────────

var nodeWorker = builder.AddNpmApp("node-worker", "../../node-worker", "dev")
    .WithHttpEndpoint(port: 50051, env: "PORT")
    .WithExternalHttpEndpoints();

// ── .NET API Backend ─────────────────────────────────────────────────

builder.AddProject<Projects.BlunzingerChess_Api>("api")
    .WithReference(database, connectionName: "DefaultConnection")
    .WithReference(nodeWorker)
    .WithExternalHttpEndpoints()
    .WithEnvironment("NodeWorker__Url", nodeWorker.GetEndpoint("http"));

builder.Build().Run();
