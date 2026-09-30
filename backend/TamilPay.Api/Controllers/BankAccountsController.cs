using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BankAccountsController(RemoteApiClient remoteApi) : ControllerBase
{
    // A mobile number can have more than one bank account row, so every match is
    // returned, not just the first.
    [HttpGet]
    public async Task<ActionResult<List<BankAccount>>> Search([FromQuery] int clientId, [FromQuery] string mobileNumber)
    {
        var result = await remoteApi.PostAsync<List<BankAccount>>("BankAccount/SelectByMobileAndClientId", new
        {
            Client_ID = MasterClient.Id,
            mobileNumber,
        });

        if (!result.IsSuccess || result.Data is not { Count: > 0 } accounts)
            return NotFound();

        return Ok(accounts);
    }

    [HttpPost]
    public async Task<ActionResult<List<BankAccount>>> Create(BankAccountRequest request)
    {
        var insertResult = await remoteApi.PostAsync<int?>("BankAccount/Insert", request.ToBankAccount());
        if (!insertResult.IsSuccess)
            return Problem(insertResult.Message, statusCode: StatusCodes.Status502BadGateway);

        return await Search(request.ClientId, request.MobileNumber);
    }

    /// <summary>
    /// There's no remote endpoint that lists every bank account for a client — only
    /// per-mobile lookup exists. So this fetches every customer for the client, then
    /// checks each one's mobile number for bank accounts. A mobile number can have
    /// more than one bank account row, so every match is returned, not just the first.
    /// </summary>
    [HttpGet("list")]
    public async Task<ActionResult<IEnumerable<BankAccount>>> ListAll([FromQuery] int clientId)
    {
        var customersResult = await remoteApi.PostAsync<List<Customer>>("customer/SelectByClientId", new { Client_ID = MasterClient.Id });
        var customers = customersResult.Data ?? [];

        var lookups = customers.Select(async c =>
        {
            var result = await remoteApi.PostAsync<List<BankAccount>>("BankAccount/SelectByMobileAndClientId", new
            {
                Client_ID = MasterClient.Id,
                mobileNumber = c.MobileNumber,
            });
            return result.Data ?? [];
        });

        var accounts = (await Task.WhenAll(lookups)).SelectMany(list => list);
        return Ok(accounts);
    }

    /// <summary>
    /// Penny-drop style verification — confirms an account+IFSC pair and returns the
    /// bank's name for it. Charges a small fee against the caller's own wallet per
    /// call (confirmed directly: omitting walletId fails with "Wallet not found for
    /// this client" instead of a real verification result).
    /// </summary>
    [HttpPost("verify")]
    public async Task<ActionResult<BankVerificationResult>> Verify(VerifyBankAccountRequest request)
    {
        var result = await remoteApi.PostAsync<BankVerificationResult>("BankAccount/Verify", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId = request.WalletId,
            AccountNumber = request.AccountNumber,
            IFSC = request.Ifsc,
        });

        if (!result.IsSuccess || string.IsNullOrWhiteSpace(result.Data?.AccountVerifiedName))
            return NotFound(new { message = result.Message });

        return Ok(result.Data);
    }
}
