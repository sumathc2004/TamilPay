using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What the frontend sends to generate a PG payment link. ClientId and WalletId
/// both come from the logged-in user (never hardcoded) — each retailer only ever generates
/// links against their own wallet.</summary>
public class PgGenerateLinkRequest
{
    [Required]
    public int ClientId { get; set; }

    [Required]
    public int WalletId { get; set; }

    // The PG's PgKey (e.g. "pg0032") — SelectByWallet's own PgKey field turned out to be
    // exactly this pgCode, confirmed by testing GenerateLink directly with a few guesses
    // before landing on it.
    [Required]
    public string PgCode { get; set; } = string.Empty;

    [Required]
    public string CustomerName { get; set; } = string.Empty;

    [Required, MaxLength(4, ErrorMessage = "Card last 4 digits must be exactly 4 digits.")]
    public string CardLast4 { get; set; } = string.Empty;

    [Required]
    public decimal Amount { get; set; }
}
