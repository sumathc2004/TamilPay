using System.ComponentModel.DataAnnotations;

using TamilPay.Api;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends to register a sender — validated here before forwarding to the remote API.</summary>
public class SenderRequest : IValidatableObject
{
    [Required]
    public int ClientId { get; set; }

    [Required, RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")]
    public string MobileNumber { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string SenderName { get; set; } = string.Empty;

    [Required, MaxLength(400)]
    public string SenderAddress { get; set; } = string.Empty;

    // PAN and Aadhaar are each optional on their own, but at least one is required — see Validate().
    [RegularExpression("^[A-Z]{5}[0-9]{4}[A-Z]$", ErrorMessage = "Enter a valid PAN, e.g. AAAAA0000A.")]
    public string? SenderPan { get; set; }

    [RegularExpression(@"^\d{12}$", ErrorMessage = "Aadhaar must be exactly 12 digits.")]
    public string? SenderAadhaar { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(SenderPan) && string.IsNullOrWhiteSpace(SenderAadhaar))
        {
            yield return new ValidationResult(
                "Provide either PAN or Aadhaar.",
                [nameof(SenderPan), nameof(SenderAadhaar)]);
        }
    }

    public Sender ToSender() => new()
    {
        ClientId = MasterClient.Id,
        MobileNumber = MobileNumber,
        SenderName = SenderName,
        SenderAddress = SenderAddress,
        // The remote columns are NOT NULL, so an omitted value must travel as "" rather than null.
        SenderPan = SenderPan ?? string.Empty,
        SenderAadhaar = SenderAadhaar ?? string.Empty,
    };
}
