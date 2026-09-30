namespace TamilPay.Api.Models;

/// <summary>Shape used by the remote Wallet/Ledger API — every debit and credit on a wallet.</summary>
public class LedgerEntry
{
    public int Id { get; set; }
    public DateTime CreatedTime { get; set; }
    public string TxnType { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string? Utr { get; set; }
    public string? SenderName { get; set; }
    public string? SenderMobile { get; set; }
    public string? AccountHolderName { get; set; }
    public string? AccountNumber { get; set; }
    public string? Ifsc { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal Charges { get; set; }
    public decimal Balance { get; set; }
}
