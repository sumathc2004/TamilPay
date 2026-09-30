using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(RemoteApiClient remoteApi) : ControllerBase
{
    // wallet/Login's response carries most of the same fields as customer/Select, but
    // isn't quite the same shape (see WalletLoginResponse) — mapped into Customer here
    // so the rest of the app can keep treating the logged-in user as one.
    [HttpPost("login")]
    public async Task<ActionResult<Customer>> Login(LoginRequest request)
    {
        var result = await remoteApi.PostAsync<List<WalletLoginResponse>>("wallet/Login", new
        {
            username = request.Username,
            password = request.Password,
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess || result.Data?.FirstOrDefault() is not { } login)
            return Unauthorized(new { message = result.Message });

        return Ok(new Customer
        {
            Id = login.CustomerId,
            ClientId = login.ClientId,
            FullName = login.FullName,
            MobileNumber = login.MobileNumber,
            EmailId = login.EmailId,
            StoreName = login.StoreName,
            Username = login.Username,
            LastBalance = login.LastBalance,
            PayoutCharges = login.PayoutCharges,
            WalletId = login.WalletId,
            IsActive = login.IsActive,
            RoleId = login.RoleId,
            RoleName = login.RoleName,
        });
    }
}
