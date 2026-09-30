using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends to submit an IMPS transfer out of the logged-in user's wallet.</summary>
public class TransactionRequest
{
    [Required]
    public int CustomerId { get; set; }

    [Required]
    public int SenderId { get; set; }

    [Required]
    public int BankAccountId { get; set; }

    [Required, Range(0.01, double.MaxValue, ErrorMessage = "Enter a valid amount.")]
    public decimal Amount { get; set; }

    [Required, RegularExpression(@"^\d{4,6}$", ErrorMessage = "Enter a valid PIN.")]
    public string Pin { get; set; } = string.Empty;
}
