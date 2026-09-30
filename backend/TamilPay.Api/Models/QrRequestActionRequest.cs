using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to approve a pending QR collect request.</summary>
public class QrRequestActionRequest
{
    [Required]
    public int Id { get; set; }
}
