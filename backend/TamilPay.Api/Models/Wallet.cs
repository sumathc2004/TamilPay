using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>
/// Shape returned by wallet/SelectByCustomerId. The remote record also carries the
/// wallet's login Password and Passpin in plain text — those are deliberately left
/// unmapped here so they never pass through our own API.
/// </summary>
public class Wallet
{
    [JsonPropertyName("Id")]
    public int WalletId { get; set; }

    [JsonPropertyName("customerId")]
    public int CustomerId { get; set; }

    [JsonPropertyName("currentBalance")]
    public decimal CurrentBalance { get; set; }

    [JsonPropertyName("payoutCharges")]
    public decimal PayoutCharges { get; set; }

    [JsonPropertyName("isActive")]
    public bool IsActive { get; set; }
}
