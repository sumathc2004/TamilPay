namespace TamilPay.Api.Models;

/// <summary>
/// Shape used by the remote Transaction/Report API — one row per transaction.
/// No explicit JsonPropertyName overrides are needed: RemoteApiClient deserializes the
/// incoming response case-insensitively, and our own outgoing API can just use the
/// default camelCase policy (accountHolderName, utr, etc.) for the frontend to consume.
/// </summary>
public class TransactionReportItem
{
    public int Id { get; set; }
    public DateTime CreatedTime { get; set; }
    public decimal Amount { get; set; }
    public string? Utr { get; set; }
    public string Status { get; set; } = string.Empty;
    public string AccountHolderName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Ifsc { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string SenderMobile { get; set; } = string.Empty;
}
