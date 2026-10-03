using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Reference entry from the remote Bank/Select master list — used to populate the Bank Name dropdown.</summary>
public class Bank
{
    [JsonPropertyName("BankCode")]
    public string BankCode { get; set; } = string.Empty;

    [JsonPropertyName("BankName")]
    public string BankName { get; set; } = string.Empty;

    // The upstream calls this IFSC_Code. Read as "IFSC" it came through empty for every
    // bank, so choosing a bank never filled in its IFSC.
    [JsonPropertyName("IFSC_Code")]
    public string Ifsc { get; set; } = string.Empty;
}
