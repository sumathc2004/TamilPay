using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to provision a new static QR code (Admin > QR > Add New).</summary>
public class QrInsertRequest
{
    [Required, MaxLength(100)]
    public string QrName { get; set; } = string.Empty;

    [Required]
    public string Vpa { get; set; } = string.Empty;

    [Required]
    public string ChargeType { get; set; } = string.Empty;

    [Required]
    public decimal ChargeValue { get; set; }

    [Required]
    public decimal MinCharge { get; set; }

    [Required]
    public decimal DailyMaxLimit { get; set; }

    [Required]
    public int DisplayOrder { get; set; }
}
