using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends to verify a bank account before saving it.</summary>
public class VerifyBankAccountRequest
{
    // The logged-in retailer's own wallet — required by the remote API (it charges a
    // small fee against this wallet per verify call); omitting it fails outright with
    // "Wallet not found for this client" rather than a normal verification failure.
    [Required]
    public int WalletId { get; set; }

    [Required, RegularExpression(@"^\d{9,18}$", ErrorMessage = "Enter a valid account number.")]
    public string AccountNumber { get; set; } = string.Empty;

    [Required, RegularExpression("^[A-Z]{4}0[A-Z0-9]{6}$", ErrorMessage = "Enter a valid IFSC code, e.g. SBIN0013351.")]
    public string Ifsc { get; set; } = string.Empty;
}
