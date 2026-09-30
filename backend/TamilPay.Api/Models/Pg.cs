using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>Our own clean shape for a Payment Gateway, returned to the frontend — mapped
/// from <see cref="PgRemoteRow"/> in the controller since the remote's field for this is
/// "PgId" (not "Id" like Group/Category), and we don't want that oddity leaking into our
/// API's output.</summary>
public class Pg
{
    public int Id { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    public int GroupId { get; set; }
    public int CategoryId { get; set; }
    public string PgName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedTime { get; set; }
    public List<PgSettlement> Settlements { get; set; } = [];

    public static Pg FromRemote(PgRemoteRow r) => new()
    {
        Id = r.PgId,
        ClientId = r.ClientId,
        GroupId = r.GroupId,
        CategoryId = r.CategoryId,
        PgName = r.PgName,
        Description = r.Description,
        DisplayOrder = r.DisplayOrder,
        IsActive = r.IsActive,
        CreatedTime = r.CreatedTime,
        Settlements = r.Settlements,
    };
}

/// <summary>Raw shape PgSettings/Pg/SelectAll actually returns — kept separate from
/// <see cref="Pg"/> because its id field is called "PgId", not "Id"; deserializing
/// straight into Pg would silently leave Id at 0 (case-insensitive matching only
/// covers casing, not a genuinely different field name).</summary>
public class PgRemoteRow
{
    public int PgId { get; set; }

    [JsonPropertyName("Client_ID")]
    public int ClientId { get; set; }

    public int GroupId { get; set; }
    public int CategoryId { get; set; }
    public string PgName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedTime { get; set; }
    public List<PgSettlement> Settlements { get; set; } = [];
}
