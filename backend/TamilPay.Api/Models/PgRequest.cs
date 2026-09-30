using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to create or update a Payment Gateway. ClientId always
/// comes from the logged-in user (never hardcoded), so each client only ever touches its own PGs.</summary>
public class PgRequest
{
    [Required]
    public int ClientId { get; set; }

    [Required]
    public int GroupId { get; set; }

    [Required]
    public int CategoryId { get; set; }

    [Required, MaxLength(150)]
    public string PgName { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
