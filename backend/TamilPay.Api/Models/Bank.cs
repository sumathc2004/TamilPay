using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Reference entry from the remote Bank/Select master list — used to populate the Bank Name dropdown.</summary>
public class Bank
{
    [JsonPropertyName("BankCode")]
    public string BankCode { get; set; } = string.Empty;

    [JsonPropertyName("BankName")]
    public string BankName { get; set; } = string.Empty;

    [JsonPropertyName("IFSC")]
    public string Ifsc { get; set; } = string.Empty;
}
