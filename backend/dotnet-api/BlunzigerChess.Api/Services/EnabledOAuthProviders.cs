namespace BlunzigerChess.Api.Services;

/// <summary>
/// Holds the list of OAuth provider names whose ClientId and ClientSecret
/// were both configured at startup.  Injected as a singleton so that
/// controllers can query which providers are available at runtime.
/// </summary>
public sealed class EnabledOAuthProviders(IReadOnlyList<string> providers)
{
    public IReadOnlyList<string> Providers { get; } = providers;

    public bool Contains(string provider, StringComparer comparer)
        => Providers.Any(p => comparer.Equals(p, provider));
}
