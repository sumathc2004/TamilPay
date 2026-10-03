using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>
/// What the frontend sends to change a wallet's login password and/or PIN. The remote
/// (Wallet/ChangePasswordPin) changes both in one call, so to change only one the
/// caller sends the unchanged value as both the old and the new one.
/// </summary>
public class ChangeCredentialsRequest
{
    [Required]
    public string OldPassword { get; set; } = string.Empty;

    [Required, RegularExpression(@"^\d{4}$", ErrorMessage = "The current PIN must be 4 digits.")]
    public string OldPasspin { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string NewPassword { get; set; } = string.Empty;

    [Required, RegularExpression(@"^\d{4}$", ErrorMessage = "The new PIN must be 4 digits.")]
    public string NewPasspin { get; set; } = string.Empty;
}
