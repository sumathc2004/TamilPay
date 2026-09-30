namespace TamilPay.Api.Models;

/// <summary>
/// Shape used by the remote Admin/ImpsTransferReport API — every retailer's IMPS
/// transfers, client-wide (as opposed to Transaction/Report, which is one wallet).
/// Field names are best-effort: the endpoint had no data yet to confirm an actual
/// row against when this was written, so the core fields mirror Transaction/Report
/// (same underlying transfer data, confirmed working), plus WalletId/CustomerName to
/// identify which retailer each row belongs to, which an unscoped report needs and a
/// per-wallet one doesn't. RemoteApiClient deserializes case-insensitively, so an
/// unmatched real field name just leaves that property at its default instead of
/// throwing — check a real row against this once one exists, and adjust if needed.
/// </summary>
public class AdminImpsReportRow
{
    public int Id { get; set; }
    public DateTime CreatedTime { get; set; }
    public int WalletId { get; set; }
    public string? CustomerName { get; set; }
    public decimal Amount { get; set; }
    public string? Utr { get; set; }
    public string Status { get; set; } = string.Empty;
    public string AccountHolderName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Ifsc { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public string SenderMobile { get; set; } = string.Empty;
}
