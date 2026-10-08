using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the browser sends to refund a transaction: which one, and why.</summary>
public class RefundRequest
{
    [Required]
    public int Id { get; set; }

    [MaxLength(200)]
    public string? Remarks { get; set; }
}
