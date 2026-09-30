using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>
/// Shape actually returned by wallet/Login — a different record from customer/Select's
/// Customer shape (despite carrying most of the same customer fields). Notably, the
/// customer's own id comes back as "customerId" here, not "Id"/"id" like every other
/// customer/* endpoint, so it can't share the Customer model directly.
/// </summary>
public class WalletLoginResponse
{
    [JsonPropertyName("customerId")]
    public int CustomerId { get; set; }

    [JsonPropertyName("walletId")]
    public int WalletId { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    [JsonPropertyName("FULL_NAME")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("MOBILE_NUMBER")]
    public string MobileNumber { get; set; } = string.Empty;

    [JsonPropertyName("EMAIL_ID")]
    public string EmailId { get; set; } = string.Empty;

    [JsonPropertyName("STORE_NAME")]
    public string StoreName { get; set; } = string.Empty;

    public string? Username { get; set; }
    public decimal LastBalance { get; set; }
    public decimal PayoutCharges { get; set; }
    public bool? IsActive { get; set; }
    public int? RoleId { get; set; }
    public string? RoleName { get; set; }
}
