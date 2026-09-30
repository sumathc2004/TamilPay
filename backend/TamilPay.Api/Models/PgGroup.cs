using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Shape returned by the remote PgSettings/Group/SelectAll API.</summary>
public class PgGroup
{
    public int Id { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    public string GroupName { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedTime { get; set; }
}
