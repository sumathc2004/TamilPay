using System.ComponentModel.DataAnnotations;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends us to create a client — validated here before forwarding to the remote API.</summary>
public class ClientRequest
{
    [Required, MaxLength(150)]
    public string ClientName { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? ClientAddress { get; set; }

    [Required, MaxLength(100)]
    public string ClientCity { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string ClientPinCode { get; set; } = string.Empty;

    [MaxLength(300)]
    public string? Website { get; set; }

    [MaxLength(50)]
    public string? IPAddress { get; set; }

    [RegularExpression("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", ErrorMessage = "Enter a valid 15-character GSTIN.")]
    public string? Gst { get; set; }

    [RegularExpression("^[A-Z]{5}[0-9]{4}[A-Z]$", ErrorMessage = "Enter a valid PAN, e.g. AAAAA0000A.")]
    public string? Pan { get; set; }

    [MaxLength(150)]
    public string? FirmName { get; set; }

    public Client ToClient() => new()
    {
        ClientName = ClientName,
        ClientAddress = ClientAddress,
        ClientCity = ClientCity,
        ClientPinCode = ClientPinCode,
        Website = Website,
        IPAddress = IPAddress,
        Gst = Gst,
        Pan = Pan,
        FirmName = FirmName,
    };
}
