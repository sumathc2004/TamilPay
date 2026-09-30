using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>
/// Shape returned by the remote BankAccount/Verify (penny-drop) API. Note the
/// misspelled "AccountVarifiedname" field — that's the remote's actual wire name.
/// </summary>
public class BankVerificationResult
{
    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    [JsonPropertyName("AccountNumber")]
    public string AccountNumber { get; set; } = string.Empty;

    [JsonPropertyName("IFSC")]
    public string Ifsc { get; set; } = string.Empty;

    [JsonPropertyName("AccountVarifiedname")]
    public string? AccountVerifiedName { get; set; }

    [JsonPropertyName("vpa")]
    public string? Vpa { get; set; }
}
