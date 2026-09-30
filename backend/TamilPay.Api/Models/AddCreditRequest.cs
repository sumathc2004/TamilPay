using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

public class AddCreditRequest
{
    [Required, Range(0.01, double.MaxValue, ErrorMessage = "Enter a valid amount.")]
    public decimal Amount { get; set; }
}
