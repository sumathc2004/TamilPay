using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to create or update a PG settings group. ClientId always
/// comes from the logged-in user (never hardcoded), so each client only ever touches its own groups.</summary>
public class PgGroupRequest
{
    [Required]
    public int ClientId { get; set; }

    [Required, MaxLength(150)]
    public string GroupName { get; set; } = string.Empty;

    public string? LogoUrl { get; set; }

    [Required]
    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
