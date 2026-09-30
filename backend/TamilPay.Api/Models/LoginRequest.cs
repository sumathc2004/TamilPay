using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>Credentials posted from the login form — forwarded to the remote wallet/Login API.</summary>
public class LoginRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    [Required]
    public int ClientId { get; set; }
}
