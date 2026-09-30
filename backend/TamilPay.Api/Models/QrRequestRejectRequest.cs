using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to reject a pending QR collect request, with a reason.</summary>
public class QrRequestRejectRequest
{
    [Required]
    public int Id { get; set; }

    [Required]
    public string Remarks { get; set; } = string.Empty;
}
