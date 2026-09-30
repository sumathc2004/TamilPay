using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Shape used by the remote BankAccount API (BankAccount/SelectByMobileAndClientId, BankAccount/Insert).</summary>
public class BankAccount
{
    public int Id { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    [JsonPropertyName("mobileNumber")]
    public string MobileNumber { get; set; } = string.Empty;

    [JsonPropertyName("AccountHolderName")]
    public string AccountHolderName { get; set; } = string.Empty;

    [JsonPropertyName("AccountNumber")]
    public string AccountNumber { get; set; } = string.Empty;

    [JsonPropertyName("IFSC")]
    public string Ifsc { get; set; } = string.Empty;

    [JsonPropertyName("BankName")]
    public string BankName { get; set; } = string.Empty;

    // Server-derived (a CDN logo lookup by bank) — never sent by the client.
    [JsonPropertyName("BankLogoUrl")]
    public string? BankLogoUrl { get; set; }
}
