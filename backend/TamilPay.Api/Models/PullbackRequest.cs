using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the browser sends to pull money back: from which retailer wallet, into which
/// admin wallet, how much, and why.</summary>
public class PullbackRequest
{
    [Required]
    public int WalletId { get; set; }

    [Required]
    public int AdminWalletId { get; set; }

    [Required]
    public decimal Amount { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}
