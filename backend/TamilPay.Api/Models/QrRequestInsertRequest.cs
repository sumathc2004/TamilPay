using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to create a QR collect request against a
/// previously pulled QR (Qr/GetNext) — the VPA/QrId pair, an amount, and a UTR.</summary>
public class QrRequestInsertRequest
{
    [Required]
    public int WalletId { get; set; }

    [Required]
    public int QrId { get; set; }

    [Required]
    public string Vpa { get; set; } = string.Empty;

    [Required]
    public decimal Amount { get; set; }

    [Required]
    public string Utr { get; set; } = string.Empty;

    /// <summary>Optional free-text note typed by the retailer; shown in the QR report.</summary>
    [MaxLength(200)]
    public string? Remarks { get; set; }
}
