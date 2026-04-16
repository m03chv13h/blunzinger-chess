namespace BlunzigerChess.Api;

/// <summary>
/// Converts PostgreSQL connection URIs (postgres://user:pass@host:port/db) to the
/// ADO.NET key-value format (Host=…;Port=…;…) that Npgsql expects.
/// Cloud providers like Render supply URIs, but the ADO.NET parser in
/// <c>DbConnectionOptions</c> only understands key-value pairs.
/// </summary>
public static class ConnectionStringHelper
{
    public static string Normalize(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return connectionString ?? string.Empty;

        if (!connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return connectionString;

        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':', 2);
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');
        var username = Uri.UnescapeDataString(userInfo[0]);
        var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;

        var result = $"Host={host};Port={port};Database={database};Username={username};Password={password}";

        // Cloud-hosted PostgreSQL (Render, Heroku, etc.) requires SSL for external connections
        result += ";SSL Mode=Require;Trust Server Certificate=true";

        return result;
    }
}
