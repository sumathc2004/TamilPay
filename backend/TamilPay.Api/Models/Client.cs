using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Shape returned by the remote Client API — also what we send back on Insert.</summary>
public class Client
{
    public int Id { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string? ClientAddress { get; set; }
    public string? ClientCity { get; set; }
    public string? ClientPinCode { get; set; }
    public string? Website { get; set; }
    public string? IPAddress { get; set; }

    [JsonPropertyName("GST")]
    public string? Gst { get; set; }

    [JsonPropertyName("PAN")]
    public string? Pan { get; set; }

    public string? FirmName { get; set; }
}
