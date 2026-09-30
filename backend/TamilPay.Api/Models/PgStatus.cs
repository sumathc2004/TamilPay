using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>"data" of Pg/CheckStatus. Everything the vendor knows about the payment,
/// including fields that must never reach the browser (charge, keyUsed) — this type is
/// internal to the backend and PgStatusResponse is what actually goes out.</summary>
public class PgVendorStatus
{
    [JsonPropertyName("reference_id")]
    public string? ReferenceId { get; set; }

    public string? VendorStatus { get; set; }
    public string? Utr { get; set; }
    public decimal? Amount { get; set; }
    public bool Credited { get; set; }

    /// <summary>The wallet balance right after this payment was credited; null until it is.</summary>
    public decimal? WalletClosingBalance { get; set; }
}

/// <summary>What the status page shows: the outcome, the amount debited, the UTR and the
/// card. Deliberately no GST, charges or vendor key.</summary>
public class PgStatusResponse
{
    public string ReferenceId { get; set; } = string.Empty;

    /// <summary>"success", "failed" or "pending".</summary>
    public string Outcome { get; set; } = "pending";

    public string Message { get; set; } = string.Empty;
    public decimal? Amount { get; set; }
    public string? Utr { get; set; }

    /// <summary>Last four digits only, as entered when the link was generated.</summary>
    public string? CardNumber { get; set; }

    /// <summary>The wallet balance right after this payment was credited (not the current
    /// balance). Null until the payment has been credited.</summary>
    public decimal? ClosingBalance { get; set; }
}
