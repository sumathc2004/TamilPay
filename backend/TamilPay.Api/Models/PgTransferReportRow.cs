using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>One row from pg/TransferReport — every link a wallet has generated
/// (PENDING/SUCCESS/FAILED) over a date range.</summary>
public class PgTransferReportRow
{
    public int Id { get; set; }
    public DateTime CreatedTime { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    public int WalletId { get; set; }
    public string? Username { get; set; }

    // "customerName" is the wallet owner (the retailer) — constant across every row for
    // a given wallet. "payerName" is who that specific link was generated for, which is
    // what actually varies per row and is what the report table shows as "Customer".
    public string CustomerName { get; set; } = string.Empty;
    public string PayerName { get; set; } = string.Empty;

    public string CardNumber { get; set; } = string.Empty;
    public string PgCode { get; set; } = string.Empty;
    public int PgId { get; set; }
    public string PgName { get; set; } = string.Empty;
    public int SettlementId { get; set; }
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
