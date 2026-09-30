namespace TamilPay.Api.Models;

/// <summary>Shape returned by pg/GenerateLink's "data" on success. Note
/// AmountCreditToBank/WeAreChargingyou come back as JSON strings (e.g. "98.2"), not
/// numbers, so they have to stay string here or deserialization throws.</summary>
public class PgGenerateLinkResult
{
    public int Id { get; set; }
    public string PgLink { get; set; } = string.Empty;
    public string RefNo { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal Charges { get; set; }
    public decimal PartnerCharges { get; set; }
    public decimal Profit { get; set; }
    public string? AmountCreditToBank { get; set; }
    public string? WeAreChargingyou { get; set; }
    public string Status { get; set; } = string.Empty;
}
