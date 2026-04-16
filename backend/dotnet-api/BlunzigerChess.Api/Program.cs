using System.Text;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.GrpcClients;
using BlunzigerChess.Api.Hubs;
using BlunzigerChess.Api.Services;
using BlunzigerChess.Proto;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ── Database ─────────────────────────────────────────────────────────

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Host=localhost;Database=blunziger_chess;Username=postgres;Password=postgres"));

// ── Authentication ───────────────────────────────────────────────────

var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "dev-secret-key-change-in-production-min-32-chars!!";
var jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "BlunzigerChess",
        ValidAudience = builder.Configuration["Jwt:Audience"] ?? "BlunzigerChess",
        IssuerSigningKey = jwtKey,
    };

    // Allow SignalR to receive token via query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/game"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
})
.AddGoogle(options =>
{
    options.ClientId = builder.Configuration["OAuth:Google:ClientId"] ?? "";
    options.ClientSecret = builder.Configuration["OAuth:Google:ClientSecret"] ?? "";
})
.AddMicrosoftAccount(options =>
{
    options.ClientId = builder.Configuration["OAuth:Microsoft:ClientId"] ?? "";
    options.ClientSecret = builder.Configuration["OAuth:Microsoft:ClientSecret"] ?? "";
})
.AddOAuth("GitHub", options =>
{
    options.ClientId = builder.Configuration["OAuth:GitHub:ClientId"] ?? "";
    options.ClientSecret = builder.Configuration["OAuth:GitHub:ClientSecret"] ?? "";
    options.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
    options.TokenEndpoint = "https://github.com/login/oauth/access_token";
    options.UserInformationEndpoint = "https://api.github.com/user";
    options.CallbackPath = "/signin-github";
    options.Scope.Add("user:email");
})
.AddOAuth("Discord", options =>
{
    options.ClientId = builder.Configuration["OAuth:Discord:ClientId"] ?? "";
    options.ClientSecret = builder.Configuration["OAuth:Discord:ClientSecret"] ?? "";
    options.AuthorizationEndpoint = "https://discord.com/api/oauth2/authorize";
    options.TokenEndpoint = "https://discord.com/api/oauth2/token";
    options.UserInformationEndpoint = "https://discord.com/api/users/@me";
    options.CallbackPath = "/signin-discord";
    options.Scope.Add("identify");
    options.Scope.Add("email");
});

builder.Services.AddAuthorization();

// ── gRPC Clients (to Node.js worker) ────────────────────────────────

var nodeWorkerUrl = builder.Configuration["NodeWorker:Url"] ?? "http://localhost:50051";

builder.Services.AddGrpcClient<GameLogicService.GameLogicServiceClient>(o =>
    o.Address = new Uri(nodeWorkerUrl));
builder.Services.AddGrpcClient<BotService.BotServiceClient>(o =>
    o.Address = new Uri(nodeWorkerUrl));
builder.Services.AddGrpcClient<EvaluationService.EvaluationServiceClient>(o =>
    o.Address = new Uri(nodeWorkerUrl));
builder.Services.AddGrpcClient<SimulationService.SimulationServiceClient>(o =>
    o.Address = new Uri(nodeWorkerUrl));

builder.Services.AddScoped<GameEngineClient>();

// ── Application Services ─────────────────────────────────────────────

builder.Services.AddScoped<AuthService>();
builder.Services.AddHostedService<MatchmakingService>();

// ── SignalR ──────────────────────────────────────────────────────────

builder.Services.AddSignalR();

// ── Controllers ──────────────────────────────────────────────────────

builder.Services.AddControllers();

// ── OpenAPI ──────────────────────────────────────────────────────────

builder.Services.AddOpenApi();

// ── CORS ─────────────────────────────────────────────────────────────

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:4173"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── Build ────────────────────────────────────────────────────────────

var app = builder.Build();

// ── Middleware Pipeline ──────────────────────────────────────────────

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<GameHub>("/hubs/game");

app.MapOpenApi();
app.MapScalarApiReference();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// ── Auto-migrate in development ──────────────────────────────────────

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.Run();
