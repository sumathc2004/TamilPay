using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What an admin sends to create or edit an announcement (Announcement/Insert and /Update).</summary>
public class AnnouncementRequest
{
    [Required, MaxLength(100)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string Message { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
