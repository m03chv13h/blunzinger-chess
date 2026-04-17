namespace BlunzigerChess.Api;

/// <summary>
/// Ensures gRPC endpoint addresses have a valid URI scheme.
/// Render's <c>fromService</c> with <c>property: hostport</c> returns bare
/// <c>hostname:port</c> values (e.g. <c>blunziger-node-worker:50051</c>).
/// Without a scheme prefix, <see cref="System.Uri"/> misparses the hostname
/// as a URI scheme, causing gRPC to fail with
/// <c>No address resolver configured for the scheme '…'</c>.
/// </summary>
public static class GrpcAddressHelper
{
    public static string NormalizeUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
            return "http://localhost:50051";

        url = url.Trim();

        if (url.Contains("://", StringComparison.Ordinal))
            return url;

        return $"http://{url}";
    }
}
