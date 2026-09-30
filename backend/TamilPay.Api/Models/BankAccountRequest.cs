using System.ComponentModel.DataAnnotations;

using TamilPay.Api;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends to register a bank account — validated here before forwarding to the remote API.</summary>
public class BankAccountRequest
{
    [Required]
    public int ClientId { get; set; }

    // The remote rejects this with "Sender not found for this mobile number and client"
    // if no Sender exists yet for this mobile+client — register the sender first.
    [Required, RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")]
    public string MobileNumber { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string AccountHolderName { get; set; } = string.Empty;

    [Required, RegularExpression(@"^\d{9,18}$", ErrorMessage = "Enter a valid account number.")]
    public string AccountNumber { get; set; } = string.Empty;

    [Required, RegularExpression("^[A-Z]{4}0[A-Z0-9]{6}$", ErrorMessage = "Enter a valid IFSC code, e.g. SBIN0013351.")]
    public string Ifsc { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string BankName { get; set; } = string.Empty;

    public BankAccount ToBankAccount() => new()
    {
        ClientId = MasterClient.Id,
        MobileNumber = MobileNumber,
        AccountHolderName = AccountHolderName,
        AccountNumber = AccountNumber,
        Ifsc = Ifsc,
        BankName = BankName,
    };
}
