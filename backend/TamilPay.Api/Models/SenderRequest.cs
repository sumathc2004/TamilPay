using System.ComponentModel.DataAnnotations;

using TamilPay.Api;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends to register a sender. Only the name is asked for; the
/// address, PAN and Aadhaar are optional and validated for shape only if someone supplies
/// them.</summary>
public class SenderRequest
{
    [Required]
    public int ClientId { get; set; }

    [Required, RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")]
    public string MobileNumber { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string SenderName { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? SenderAddress { get; set; }

    [RegularExpression("^[A-Z]{5}[0-9]{4}[A-Z]$", ErrorMessage = "Enter a valid PAN, e.g. AAAAA0000A.")]
    public string? SenderPan { get; set; }

    [RegularExpression(@"^\d{12}$", ErrorMessage = "Aadhaar must be exactly 12 digits.")]
    public string? SenderAadhaar { get; set; }

    public Sender ToSender() => new()
    {
        ClientId = MasterClient.Id,
        MobileNumber = MobileNumber,
        SenderName = SenderName,
        // The remote columns are NOT NULL, so an omitted value must travel as "" rather than null.
        SenderAddress = SenderAddress ?? string.Empty,
        SenderPan = SenderPan ?? string.Empty,
        SenderAadhaar = SenderAadhaar ?? string.Empty,
    };
}
