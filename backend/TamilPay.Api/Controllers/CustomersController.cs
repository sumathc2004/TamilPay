using System.Text.Json;
using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomersController(RemoteApiClient remoteApi) : ControllerBase
{
    private const string BasePath = "customer";

    /// <summary>
    /// Always scoped to the master client. The unscoped `customer/Select`,
    /// which returns every business's customers on the shared remote, is
    /// deliberately not reachable — and the `clientId` the frontend sends is
    /// ignored rather than trusted.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Customer>>> GetAll([FromQuery] int? clientId = null)
    {
        _ = clientId;
        var result = await remoteApi.PostAsync<List<Customer>>($"{BasePath}/SelectByClientId", new { Client_ID = MasterClient.Id });
        return Ok(result.Data ?? []);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Customer>> GetById(int id)
    {
        var customer = await FindOwnedCustomerAsync(id);
        return customer is null ? NotFound() : Ok(customer);
    }

    /// <summary>
    /// The remote's SelectById is not client-scoped, so a bare id would fetch
    /// another tenant's customer. Anything not owned by the master client is
    /// reported as missing.
    /// </summary>
    private async Task<Customer?> FindOwnedCustomerAsync(int id)
    {
        var result = await remoteApi.PostAsync<List<Customer>>($"{BasePath}/SelectById", new { Id = id });
        var customer = result.Data?.FirstOrDefault();
        return customer?.ClientId == MasterClient.Id ? customer : null;
    }

    [HttpPost]
    public async Task<ActionResult<Customer>> Create(CustomerRequest request)
    {
        var clientExists = await remoteApi.PostAsync<List<Client>>("Client/SelectById", new { Id = MasterClient.Id });
        if (clientExists.Data?.FirstOrDefault() is null)
        {
            ModelState.AddModelError(nameof(request.ClientId), "No client exists with this ClientId.");
            return ValidationProblem(ModelState);
        }

        var insertResult = await remoteApi.PostAsync<int?>($"{BasePath}/Insert", request.ToCustomer(id: 0));
        if (!insertResult.IsSuccess || insertResult.Data is not int newId)
            return Problem(insertResult.Message, statusCode: StatusCodes.Status502BadGateway);

        if (request.RoleId is int roleId)
            await AssignRoleAsync(newId, roleId);

        var created = await GetById(newId);
        return created.Result is OkObjectResult ok
            ? CreatedAtAction(nameof(GetById), new { id = newId }, ok.Value)
            : created.Result!;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Customer>> Update(int id, CustomerRequest request)
    {
        if (await FindOwnedCustomerAsync(id) is null) return NotFound();

        var clientExists = await remoteApi.PostAsync<List<Client>>("Client/SelectById", new { Id = MasterClient.Id });
        if (clientExists.Data?.FirstOrDefault() is null)
        {
            ModelState.AddModelError(nameof(request.ClientId), "No client exists with this ClientId.");
            return ValidationProblem(ModelState);
        }

        var updateResult = await remoteApi.PostAsync<int?>($"{BasePath}/Update", request.ToCustomer(id));
        if (!updateResult.IsSuccess)
            return Problem(updateResult.Message, statusCode: StatusCodes.Status502BadGateway);

        if (request.RoleId is int roleId)
            await AssignRoleAsync(id, roleId);

        return await GetById(id);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        if (await FindOwnedCustomerAsync(id) is null) return NotFound();

        await remoteApi.PostAsync<object?>($"{BasePath}/Delete", new { Id = id });

        // The remote API's own success flag on Delete is unreliable, so confirm by re-checking.
        var check = await FindOwnedCustomerAsync(id);
        return check is null
            ? NoContent()
            : Problem("Remote API did not delete the customer.", statusCode: StatusCodes.Status502BadGateway);
    }

    /// <summary>Provisions a wallet for a customer that doesn't have one yet (Username is still null).</summary>
    [HttpPost("{id:int}/wallet")]
    public async Task<ActionResult<Customer>> AddWallet(int id)
    {
        if (await FindOwnedCustomerAsync(id) is not { } customer) return NotFound();
        if (customer.Username is not null) return Conflict(new { message = "This customer already has a wallet." });

        var addResult = await remoteApi.PostAsync<int?>("wallet/Add", new { CustomerId = id });
        if (!addResult.IsSuccess)
            return Problem(addResult.Message, statusCode: StatusCodes.Status502BadGateway);

        return await GetById(id);
    }

    [HttpGet("{id:int}/wallet")]
    public async Task<ActionResult<Wallet>> GetWallet(int id)
    {
        var result = await remoteApi.PostAsync<List<Wallet>>("wallet/SelectByCustomerId", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            CustomerId = id,
        });

        if (!result.IsSuccess || result.Data?.FirstOrDefault() is not { } wallet)
            return NotFound();

        return Ok(wallet);
    }

    /// <summary>
    /// Changes the customer's wallet login password and PIN. The wallet is found from the
    /// customer id here rather than taken from the browser, and the remote checks the old
    /// password and PIN itself — a wrong one comes back as its message, not a success.
    /// </summary>
    [HttpPost("{id:int}/wallet/credentials")]
    public async Task<IActionResult> ChangeCredentials(int id, ChangeCredentialsRequest request)
    {
        var walletResult = await GetWallet(id);
        if (walletResult.Result is not OkObjectResult { Value: Wallet wallet })
            return NotFound(new { message = "No wallet is linked to this account." });

        var result = await remoteApi.PostAsync<JsonElement?>("Wallet/ChangePasswordPin", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId = wallet.WalletId,
            oldPassword = request.OldPassword,
            oldPasspin = request.OldPasspin,
            newPassword = request.NewPassword,
            newPasspin = request.NewPasspin,
        });

        if (!result.IsSuccess)
            return UnprocessableEntity(new { message = string.IsNullOrWhiteSpace(result.Message) ? "The password or PIN could not be changed." : result.Message });

        return Ok(new { message = string.IsNullOrWhiteSpace(result.Message) ? "Updated." : result.Message });
    }

    [HttpPut("{id:int}/wallet/payout-charges")]
    public async Task<ActionResult<Wallet>> UpdatePayoutCharges(int id, UpdatePayoutChargesRequest request)
    {
        var walletResult = await GetWallet(id);
        if (walletResult.Result is not OkObjectResult { Value: Wallet wallet })
            return walletResult.Result!;

        var updateResult = await remoteApi.PostAsync<int?>("wallet/UpdatePayoutCharges", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId = wallet.WalletId,
            payoutCharges = request.PayoutCharges,
        });
        if (!updateResult.IsSuccess)
            return Problem(updateResult.Message, statusCode: StatusCodes.Status502BadGateway);

        return await GetWallet(id);
    }

    [HttpPost("{id:int}/wallet/credit")]
    public async Task<ActionResult<Wallet>> AddCredit(int id, AddCreditRequest request)
    {
        var walletResult = await GetWallet(id);
        if (walletResult.Result is not OkObjectResult { Value: Wallet wallet })
            return walletResult.Result!;

        var creditResult = await remoteApi.PostAsync<int?>("Wallet/Credit", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId = wallet.WalletId,
            Amount = request.Amount,
            remarks = "Manual topup",
        });
        if (!creditResult.IsSuccess)
            return Problem(creditResult.Message, statusCode: StatusCodes.Status502BadGateway);

        return await GetWallet(id);
    }

    /// <summary>Moves balance from the logged-in admin's own wallet (route id) to another customer's wallet.</summary>
    [HttpPost("{id:int}/wallet/transfer")]
    public async Task<IActionResult> TransferWallet(int id, WalletTransferRequest request)
    {
        var walletResult = await GetWallet(id);
        if (walletResult.Result is not OkObjectResult { Value: Wallet fromWallet })
            return walletResult.Result!;

        if (request.Amount > fromWallet.CurrentBalance)
            return BadRequest(new { message = "Insufficient balance." });

        var transferResult = await remoteApi.PostAsync<int?>("Wallet/Transfer", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            fromWalletId = fromWallet.WalletId,
            toWalletId = request.ToWalletId,
            Amount = request.Amount,
            remarks = "Wallet Transfer",
        });
        if (!transferResult.IsSuccess)
            return Problem(transferResult.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = "Transfer completed.", transferId = transferResult.Data });
    }

    // No single remote endpoint lists "every retailer's wallet" for a client — mirrors
    // BankAccountsController.ListAll's approach: fetch every customer, then look up
    // each one's wallet. Only customers with a wallet (a non-null Username, set once
    // wallet/Add has run for them) can actually be picked — used to populate the PG
    // Settings "Apply to Individual" retailer picker.
    [HttpGet("retailers")]
    public async Task<ActionResult<IEnumerable<object>>> GetRetailers([FromQuery] int clientId)
    {
        var customersResult = await remoteApi.PostAsync<List<Customer>>($"{BasePath}/SelectByClientId", new { Client_ID = MasterClient.Id });
        var customers = (customersResult.Data ?? []).Where(c => c.Username is not null);

        var lookups = customers.Select(async c =>
        {
            var walletResult = await remoteApi.PostAsync<List<Wallet>>("wallet/SelectByCustomerId", new
            {
                Client_ID = MasterClient.Id,
                CustomerId = c.Id,
            });
            var wallet = walletResult.Data?.FirstOrDefault();
            return wallet is null ? null : new { customerId = c.Id, fullName = c.FullName, storeName = c.StoreName, walletId = wallet.WalletId };
        });

        var retailers = (await Task.WhenAll(lookups)).Where(r => r is not null);
        return Ok(retailers);
    }

    // Undocumented endpoint; its status message is as unreliable as Delete's, so callers
    // re-fetch the customer afterward to see whether it actually took effect.
    private async Task AssignRoleAsync(int id, int roleId) =>
        await remoteApi.PostAsync<object?>("Customer/AssignRole", new { Id = id, RoleId = roleId });
}
