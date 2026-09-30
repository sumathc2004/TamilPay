using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Shape used by the remote Sender API (sender/SelectByMobileAndClientId, sender/Insert).</summary>
public class Sender
{
    public int Id { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    [JsonPropertyName("mobileNumber")]
    public string MobileNumber { get; set; } = string.Empty;

    [JsonPropertyName("SenderName")]
    public string SenderName { get; set; } = string.Empty;

    [JsonPropertyName("SenderAddress")]
    public string SenderAddress { get; set; } = string.Empty;

    [JsonPropertyName("senderPan")]
    public string SenderPan { get; set; } = string.Empty;

    [JsonPropertyName("senderAadhaar")]
    public string SenderAadhaar { get; set; } = string.Empty;
}
