namespace TamilPay.Api.Models;

/// <summary>One row from Pg/SelectByWallet — flat, one row per Group × Settlement × PG
/// combination actually mapped to a wallet (a PG belongs to exactly one Category, so that
/// comes along for the ride on each row too).</summary>
public class PgWalletRow
{
    public int GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public int SettlementId { get; set; }
    public string SettlementName { get; set; } = string.Empty;
    public int SettlementDays { get; set; }
    public string? PgKey { get; set; }
    public string? PartnerChargeType { get; set; }
    // Every charge field is genuinely optional upstream — an unconfigured one comes
    // back as null (MaxLimit usually is), and a non-nullable decimal here made the
    // whole response fail to parse, surfacing as a 502 and a PG page stuck loading.
    public decimal? PartnerChargeValue { get; set; }
    public decimal? PartnerMinCharge { get; set; }
    public string? ChargeType { get; set; }
    public decimal? ChargeValue { get; set; }
    public decimal? MinCharge { get; set; }
    public decimal? MaxLimit { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public int PgId { get; set; }
    public string PgName { get; set; } = string.Empty;
    public string? Description { get; set; }
}
