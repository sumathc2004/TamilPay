using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

public class UpdatePayoutChargesRequest
{
    [Required, Range(0, double.MaxValue, ErrorMessage = "Enter a valid payout charge.")]
    public decimal PayoutCharges { get; set; }
}
