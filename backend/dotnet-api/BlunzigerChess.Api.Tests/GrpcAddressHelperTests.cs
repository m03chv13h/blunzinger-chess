using BlunzigerChess.Api;

namespace BlunzigerChess.Api.Tests;

public class GrpcAddressHelperTests
{
    [Fact]
    public void NormalizeUrl_PrependsHttp_WhenSchemeIsMissing()
    {
        // Render's fromService hostport value: bare hostname:port
        var result = GrpcAddressHelper.NormalizeUrl("blunziger-node-worker:50051");

        Assert.Equal("http://blunziger-node-worker:50051", result);
    }

    [Fact]
    public void NormalizeUrl_PreservesExistingHttpScheme()
    {
        var result = GrpcAddressHelper.NormalizeUrl("http://localhost:50051");

        Assert.Equal("http://localhost:50051", result);
    }

    [Fact]
    public void NormalizeUrl_PreservesExistingHttpsScheme()
    {
        var result = GrpcAddressHelper.NormalizeUrl("https://worker.example.com:50051");

        Assert.Equal("https://worker.example.com:50051", result);
    }

    [Fact]
    public void NormalizeUrl_ReturnsDefault_WhenNull()
    {
        var result = GrpcAddressHelper.NormalizeUrl(null);

        Assert.Equal("http://localhost:50051", result);
    }

    [Fact]
    public void NormalizeUrl_ReturnsDefault_WhenEmpty()
    {
        var result = GrpcAddressHelper.NormalizeUrl("");

        Assert.Equal("http://localhost:50051", result);
    }

    [Fact]
    public void NormalizeUrl_ReturnsDefault_WhenWhitespace()
    {
        var result = GrpcAddressHelper.NormalizeUrl("   ");

        Assert.Equal("http://localhost:50051", result);
    }

    [Fact]
    public void NormalizeUrl_TrimsWhitespace()
    {
        var result = GrpcAddressHelper.NormalizeUrl("  blunziger-node-worker:50051  ");

        Assert.Equal("http://blunziger-node-worker:50051", result);
    }

    [Fact]
    public void NormalizeUrl_HandlesHostnameOnly()
    {
        var result = GrpcAddressHelper.NormalizeUrl("worker-host");

        Assert.Equal("http://worker-host", result);
    }
}
