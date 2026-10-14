using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What an admin sends to set a new wallet password and/or transaction PIN for a customer.
/// Send only the one to change, or both.</summary>
public class AdminResetPasswordRequest
{
    /// <summary>The new login password. Leave empty to keep the current one.</summary>
    [MaxLength(64)]
    public string? NewPassword { get; set; }

    /// <summary>The new 4-digit transaction PIN. Leave empty to keep the current one.</summary>
    public string? NewPin { get; set; }
}
