using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Shape returned by the remote PgSettings/Category/SelectAll API. That endpoint
/// isn't deployed upstream yet (404 as of this writing) — this mirrors PgGroup's shape,
/// the closest known-working sibling endpoint, and should be double-checked once it's live.</summary>
public class PgCategory
{
    public int Id { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    public string CategoryName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedTime { get; set; }
}
