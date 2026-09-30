using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to create or update a PG settings category. ClientId
/// always comes from the logged-in user (never hardcoded).</summary>
public class PgCategoryRequest
{
    [Required]
    public int ClientId { get; set; }

    [Required, MaxLength(150)]
    public string CategoryName { get; set; } = string.Empty;

    [Required]
    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
