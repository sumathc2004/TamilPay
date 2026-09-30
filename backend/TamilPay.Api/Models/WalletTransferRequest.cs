using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>
/// What our frontend sends to move balance from the logged-in admin's own wallet to
/// another one — the source wallet is resolved server-side from the route's customer
/// id, never trusted from the client.
/// </summary>
public class WalletTransferRequest
{
    [Required]
    public int ToWalletId { get; set; }

    [Required, Range(0.01, double.MaxValue, ErrorMessage = "Enter a valid amount.")]
    public decimal Amount { get; set; }
}
