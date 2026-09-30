using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>
/// Shape used by the remote Admin/PgTransferReport API — every retailer's PG links,
/// client-wide (as opposed to pg/TransferReport, which is one wallet). Confirmed
/// directly against a real response; "MOBILE_NUMBER" is the one field whose casing
/// doesn't match case-insensitively and needs an explicit override, same as Customer.cs.
/// </summary>
public class AdminPgReportRow
{
    public int Id { get; set; }
    public DateTime CreatedTime { get; set; }
    public int WalletId { get; set; }
    public string? Username { get; set; }
    public string RetailerName { get; set; } = string.Empty;

    [JsonPropertyName("MOBILE_NUMBER")]
    public string MobileNumber { get; set; } = string.Empty;

    public string PayerName { get; set; } = string.Empty;
    public string CardNumber { get; set; } = string.Empty;
    public string PgCode { get; set; } = string.Empty;
    public string PgName { get; set; } = string.Empty;
    public string SettlementName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal Charges { get; set; }
    public decimal PartnerCharges { get; set; }
    public decimal Profit { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PipeRefNumber { get; set; }
    public string? PgLink { get; set; }
    public DateTime? WalletCreditedTime { get; set; }
    public decimal? WalletClosingBalance { get; set; }
}
