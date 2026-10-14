using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What an admin sends to map a retailer to a distributor: which retailer's wallet, and the
/// PG commission (in percent) the distributor earns on it.</summary>
public class AddMappingRequest
{
    [Required]
    public int RetailerWalletId { get; set; }

    [Required]
    public decimal PgCommissionPercent { get; set; }
}
