var builder = DistributedApplication.CreateBuilder(args);

// ── PostgreSQL ───────────────────────────────────────────────────────

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("blunziger-chess-pgdata");

var database = postgres.AddDatabase("blunziger_chess");

// ── Node.js Game Engine Worker ───────────────────────────────────────

var nodeWorker = builder.AddNpmApp("node-worker", "../../node-worker", "dev")
    .WithHttpEndpoint(port: 50051, env: "PORT")
    .WithExternalHttpEndpoints();

// ── .NET API Backend ─────────────────────────────────────────────────

builder.AddProject<Projects.BlunzigerChess_Api>("api")
    .WithReference(database)
    .WithReference(nodeWorker)
    .WithExternalHttpEndpoints()
    .WithEnvironment("ConnectionStrings__DefaultConnection", database)
    .WithEnvironment("NodeWorker__Url", nodeWorker.GetEndpoint("http"));

builder.Build().Run();
