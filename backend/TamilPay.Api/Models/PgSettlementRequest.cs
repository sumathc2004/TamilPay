using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to create or update a PG settlement. ClientId always
/// comes from the logged-in user (never hardcoded). PgId is only meaningful on create —
/// the remote's Update call identifies the row by Id alone.</summary>
public class PgSettlementRequest
{
    [Required]
    public int ClientId { get; set; }

    public int PgId { get; set; }

    [Required, MaxLength(150)]
    public string SettlementName { get; set; } = string.Empty;

    [Required]
    public int SettlementDays { get; set; }

    public string? PgKey { get; set; }

    [Required]
    public string PartnerChargeType { get; set; } = "PERCENT";

    [Required]
    public decimal PartnerChargeValue { get; set; }

    [Required]
    public decimal PartnerMinCharge { get; set; }

    [Required]
    public string ChargeType { get; set; } = "PERCENT";

    [Required]
    public decimal ChargeValue { get; set; }

    [Required]
    public decimal MinCharge { get; set; }

    public bool IsActive { get; set; } = true;
}
