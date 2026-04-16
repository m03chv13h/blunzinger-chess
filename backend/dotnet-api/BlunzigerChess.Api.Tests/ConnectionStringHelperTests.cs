using BlunzigerChess.Api;

namespace BlunzigerChess.Api.Tests;

public class ConnectionStringHelperTests
{
    [Fact]
    public void Normalize_ReturnsKeyValueFormat_ForPostgresUri()
    {
        var uri = "postgres://myuser:mypass@db-host.render.com:5432/mydb";
        var result = ConnectionStringHelper.Normalize(uri);

        Assert.Contains("Host=db-host.render.com", result);
        Assert.Contains("Port=5432", result);
        Assert.Contains("Database=mydb", result);
        Assert.Contains("Username=myuser", result);
        Assert.Contains("Password=mypass", result);
        Assert.Contains("SSL Mode=Require", result);
    }

    [Fact]
    public void Normalize_ReturnsKeyValueFormat_ForPostgresqlUri()
    {
        var uri = "postgresql://user:secret@host.example.com:5433/chess_db";
        var result = ConnectionStringHelper.Normalize(uri);

        Assert.Contains("Host=host.example.com", result);
        Assert.Contains("Port=5433", result);
        Assert.Contains("Database=chess_db", result);
        Assert.Contains("Username=user", result);
        Assert.Contains("Password=secret", result);
    }

    [Fact]
    public void Normalize_HandlesUrlEncodedCredentials()
    {
        var uri = "postgres://my%40user:p%40ss%3Aword@host:5432/db";
        var result = ConnectionStringHelper.Normalize(uri);

        Assert.Contains("Username=my@user", result);
        Assert.Contains("Password=p@ss:word", result);
    }

    [Fact]
    public void Normalize_PassesThroughKeyValueFormat()
    {
        var kvString = "Host=localhost;Database=blunziger_chess;Username=postgres;Password=postgres";
        var result = ConnectionStringHelper.Normalize(kvString);

        Assert.Equal(kvString, result);
    }

    [Fact]
    public void Normalize_ReturnsEmptyString_ForNull()
    {
        var result = ConnectionStringHelper.Normalize(null);
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void Normalize_ReturnsEmptyString_ForWhitespace()
    {
        var result = ConnectionStringHelper.Normalize("   ");
        Assert.Equal("   ", result);
    }

    [Fact]
    public void Normalize_HandlesDefaultPort()
    {
        // Port -1 in Uri means no port specified; should default to 5432
        var uri = "postgres://user:pass@host/db";
        var result = ConnectionStringHelper.Normalize(uri);

        Assert.Contains("Port=5432", result);
    }

    [Fact]
    public void Normalize_HandlesPasswordWithSpecialCharacters()
    {
        var uri = "postgres://user:p%23ss%26word@host:5432/db";
        var result = ConnectionStringHelper.Normalize(uri);

        Assert.Contains("Password=p#ss&word", result);
    }

    [Fact]
    public void Normalize_IsCaseInsensitive_ForScheme()
    {
        var uri = "POSTGRES://user:pass@host:5432/db";
        var result = ConnectionStringHelper.Normalize(uri);

        Assert.Contains("Host=host", result);
        Assert.Contains("Database=db", result);
    }
}
