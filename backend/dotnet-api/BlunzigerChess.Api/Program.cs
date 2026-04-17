using System.Text;
using BlunzigerChess.Api;
using BlunzigerChess.Api.Data;
using BlunzigerChess.Api.GrpcClients;
using BlunzigerChess.Api.Hubs;
using BlunzigerChess.Api.Services;
using BlunzigerChess.Proto;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ── Database ─────────────────────────────────────────────────────────

var connectionString = ConnectionStringHelper.Normalize(
    builder.Configuration.GetConnectionString("DefaultConnection"));

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(string.IsNullOrWhiteSpace(connectionString)
        ? "Host=localhost;Database=blunziger_chess;Username=postgres;Password=postgres"
        : connectionString));

// ── Authentication ───────────────────────────────────────────────────

var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "dev-secret-key-change-in-production-min-32-chars!!";
var jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

// Track which OAuth providers have credentials configured.
var enabledOAuthProviders = new List<string>();

var authBuilder = builder.Services.AddAuthentication(options =>
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
});

// Only register OAuth providers whose ClientId and ClientSecret are both provided.

var googleClientId = builder.Configuration["OAuth:Google:ClientId"];
var googleClientSecret = builder.Configuration["OAuth:Google:ClientSecret"];
if (!string.IsNullOrWhiteSpace(googleClientId) && !string.IsNullOrWhiteSpace(googleClientSecret))
{
    authBuilder.AddGoogle(options =>
    {
        options.ClientId = googleClientId;
        options.ClientSecret = googleClientSecret;
    });
    enabledOAuthProviders.Add("Google");
}

var msClientId = builder.Configuration["OAuth:Microsoft:ClientId"];
var msClientSecret = builder.Configuration["OAuth:Microsoft:ClientSecret"];
if (!string.IsNullOrWhiteSpace(msClientId) && !string.IsNullOrWhiteSpace(msClientSecret))
{
    authBuilder.AddMicrosoftAccount(options =>
    {
        options.ClientId = msClientId;
        options.ClientSecret = msClientSecret;
    });
    enabledOAuthProviders.Add("Microsoft");
}

var ghClientId = builder.Configuration["OAuth:GitHub:ClientId"];
var ghClientSecret = builder.Configuration["OAuth:GitHub:ClientSecret"];
if (!string.IsNullOrWhiteSpace(ghClientId) && !string.IsNullOrWhiteSpace(ghClientSecret))
{
    authBuilder.AddOAuth("GitHub", options =>
    {
        options.ClientId = ghClientId;
        options.ClientSecret = ghClientSecret;
        options.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
        options.TokenEndpoint = "https://github.com/login/oauth/access_token";
        options.UserInformationEndpoint = "https://api.github.com/user";
        options.CallbackPath = "/signin-github";
        options.Scope.Add("user:email");
    });
    enabledOAuthProviders.Add("GitHub");
}

var discordClientId = builder.Configuration["OAuth:Discord:ClientId"];
var discordClientSecret = builder.Configuration["OAuth:Discord:ClientSecret"];
if (!string.IsNullOrWhiteSpace(discordClientId) && !string.IsNullOrWhiteSpace(discordClientSecret))
{
    authBuilder.AddOAuth("Discord", options =>
    {
        options.ClientId = discordClientId;
        options.ClientSecret = discordClientSecret;
        options.AuthorizationEndpoint = "https://discord.com/api/oauth2/authorize";
        options.TokenEndpoint = "https://discord.com/api/oauth2/token";
        options.UserInformationEndpoint = "https://discord.com/api/users/@me";
        options.CallbackPath = "/signin-discord";
        options.Scope.Add("identify");
        options.Scope.Add("email");
    });
    enabledOAuthProviders.Add("Discord");
}

// Make the enabled providers list available via DI.
builder.Services.AddSingleton(new EnabledOAuthProviders(enabledOAuthProviders));

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

var allowedOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:4173"])
    .Select(o => o.Trim())
    .Where(o => !string.IsNullOrEmpty(o))
    .Select(o => o.Contains("://") ? o : $"https://{o}")
    .Select(o => o.TrimEnd('/'))
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin => allowedOrigins.Contains(origin.TrimEnd('/')))
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ── Build ────────────────────────────────────────────────────────────

var app = builder.Build();

// ── Middleware Pipeline ──────────────────────────────────────────────

var forwardedHeadersOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
};
// Cloud PaaS proxies (Render, etc.) use dynamic IPs; clear the default
// loopback-only lists so the middleware accepts their forwarded headers.
// ForwardLimit = 1 (the default) still prevents chained header spoofing.
forwardedHeadersOptions.KnownProxies.Clear();
forwardedHeadersOptions.KnownIPNetworks.Clear();
app.UseForwardedHeaders(forwardedHeadersOptions);
app.UseCors();

app.Logger.LogInformation("CORS allowed origins: {Origins}", string.Join(", ", allowedOrigins));

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<GameHub>("/hubs/game");

app.MapOpenApi();
app.MapScalarApiReference();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// ── Auto-migrate database ────────────────────────────────────────────

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.Run();
