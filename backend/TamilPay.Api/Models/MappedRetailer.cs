using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>One retailer mapped to a distributor — a row of Distributor/Mapping/SelectRetailers.
/// The remote's upper-case names are kept as they are, the way Customer keeps its own.</summary>
public class MappedRetailer
{
    public int Id { get; set; }
    public int RetailerWalletId { get; set; }
    public int DistributorWalletId { get; set; }

    /// <summary>The share of each PG payment's charge the distributor earns on this retailer, in percent.</summary>
    public decimal? PgCommissionPercent { get; set; }

    [JsonPropertyName("FULL_NAME")]
    public string? FullName { get; set; }

    [JsonPropertyName("MOBILE_NUMBER")]
    public string? MobileNumber { get; set; }

    [JsonPropertyName("STORE_NAME")]
    public string? StoreName { get; set; }

    public string? Username { get; set; }
    public decimal CurrentBalance { get; set; }
}
