using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>
/// Shape used by the remote Customer API (http://172.198.160.73/clients/api/customer/*).
/// The remote API's field names don't follow a consistent convention, so each one is
/// pinned explicitly — this is the exact wire format for both reading and writing.
/// </summary>
public class Customer
{
    public int Id { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    [JsonPropertyName("PAN")]
    public string Pan { get; set; } = string.Empty;

    [JsonPropertyName("ADHAAR")]
    public string Aadhaar { get; set; } = string.Empty;

    [JsonPropertyName("FULL_NAME")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("DATE_OF_BIRTH")]
    public DateOnly DateOfBirth { get; set; }

    [JsonPropertyName("RESIDENTIAL_ADDRESS")]
    public string ResidentialAddress { get; set; } = string.Empty;

    [JsonPropertyName("STORE_NAME")]
    public string StoreName { get; set; } = string.Empty;

    [JsonPropertyName("STORE_ADDRESS")]
    public string StoreAddress { get; set; } = string.Empty;

    [JsonPropertyName("GST")]
    public string? Gst { get; set; }

    [JsonPropertyName("MOBILE_NUMBER")]
    public string MobileNumber { get; set; } = string.Empty;

    [JsonPropertyName("EMAIL_ID")]
    public string EmailId { get; set; } = string.Empty;

    // Wallet fields, set once /wallet/Add has been called for this customer.
    public string? Username { get; set; }
    public decimal LastBalance { get; set; }
    public bool? IsActive { get; set; }

    // Only present on the wallet/Login response (login is the one place this API
    // reports it alongside the customer's own details).
    public decimal PayoutCharges { get; set; }
    public int WalletId { get; set; }

    // Role assigned to this customer (e.g. "Retailer"), if any.
    public int? RoleId { get; set; }
    public string? RoleName { get; set; }
}
