namespace TamilPay.Api.Models;

/// <summary>A settlement option attached to a PG, with its own partner-level charge and
/// a client-specific charge override — returned nested inside Pg by PgSettings/Pg/SelectAll.</summary>
public class PgSettlement
{
    public int SettlementId { get; set; }
    public string SettlementName { get; set; } = string.Empty;
    public int SettlementDays { get; set; }
    public string? PgKey { get; set; }
    public string? PartnerChargeType { get; set; }
    public decimal PartnerChargeValue { get; set; }
    public decimal PartnerMinCharge { get; set; }
    public bool IsActive { get; set; }
    public int ChargeId { get; set; }
    public string? ChargeType { get; set; }
    public decimal ChargeValue { get; set; }
    public decimal MinCharge { get; set; }
    public bool ChargeIsActive { get; set; }
}
