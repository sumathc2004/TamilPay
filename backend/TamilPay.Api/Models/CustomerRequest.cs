using System.ComponentModel.DataAnnotations;

using TamilPay.Api;

namespace TamilPay.Api.Models;

/// <summary>What our frontend sends us to create/update a customer — validated here before forwarding to the remote API.</summary>
public class CustomerRequest
{
    [Required]
    public int ClientId { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{5}[0-9]{4}[A-Z]$", ErrorMessage = "Enter a valid PAN, e.g. AAAAA0000A.")]
    public string Pan { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^\d{12}$", ErrorMessage = "Aadhaar must be exactly 12 digits.")]
    public string Aadhaar { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    public DateOnly DateOfBirth { get; set; }

    [Required, MaxLength(400)]
    public string ResidentialAddress { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string StoreName { get; set; } = string.Empty;

    [Required, MaxLength(400)]
    public string StoreAddress { get; set; } = string.Empty;

    [RegularExpression("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$", ErrorMessage = "Enter a valid 15-character GSTIN.")]
    public string? Gst { get; set; }

    [Required]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit Indian mobile number.")]
    public string MobileNumber { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string EmailId { get; set; } = string.Empty;

    // customer/Insert and customer/Update both silently ignore this field — the role is
    // actually set with a separate call to Customer/AssignRole (see CustomersController).
    public int? RoleId { get; set; }

    public Customer ToCustomer(int id) => new()
    {
        Id = id,
        ClientId = MasterClient.Id,
        Pan = Pan,
        Aadhaar = Aadhaar,
        FullName = FullName,
        DateOfBirth = DateOfBirth,
        ResidentialAddress = ResidentialAddress,
        StoreName = StoreName,
        StoreAddress = StoreAddress,
        // The remote GST column is NOT NULL, so an empty value must travel as "" rather than null.
        Gst = Gst ?? string.Empty,
        MobileNumber = MobileNumber,
        EmailId = EmailId,
        RoleId = RoleId,
    };
}
