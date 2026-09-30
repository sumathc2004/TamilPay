namespace TamilPay.Api.Models;

/// <summary>Shape returned by the remote Role/Select API.</summary>
public class Role
{
    public int Id { get; set; }
    public string RoleName { get; set; } = string.Empty;
}
