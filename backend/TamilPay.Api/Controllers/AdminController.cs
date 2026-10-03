using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

/// <summary>Admin-only, client-wide reports — as opposed to TransactionsController's
/// per-wallet reports. Mirrors the remote Admin/* namespace.</summary>
[ApiController]
[Route("api/[controller]")]
public class AdminController(RemoteApiClient remoteApi, IMemoryCache cache) : ControllerBase
{
    // The remote's IMPS report names no retailer (customerName comes back null) — only a
    // walletId. Wallet -> retailer name is resolved here the way CustomersController's
    // retailers list does it (every customer, then each one's wallet), and kept for a few
    // minutes since it takes one remote call per customer and rarely changes.
    private async Task<Dictionary<int, (string Name, string Mobile)>> GetWalletOwnersAsync()
    {
        if (cache.TryGetValue<Dictionary<int, (string Name, string Mobile)>>("wallet-owners", out var cached) && cached is not null)
            return cached;

        var customers = await remoteApi.PostAsync<List<Customer>>("customer/SelectByClientId", new { Client_ID = MasterClient.Id });
        var lookups = (customers.Data ?? []).Where(c => c.Username is not null).Select(async c =>
        {
            var wallet = (await remoteApi.PostAsync<List<Wallet>>("wallet/SelectByCustomerId", new
            {
                Client_ID = MasterClient.Id,
                CustomerId = c.Id,
            })).Data?.FirstOrDefault();
            return (WalletId: wallet?.WalletId, Name: string.IsNullOrWhiteSpace(c.FullName) ? c.StoreName : c.FullName, Mobile: c.MobileNumber);
        });

        var owners = (await Task.WhenAll(lookups))
            .Where(o => o.WalletId is not null && !string.IsNullOrWhiteSpace(o.Name))
            .GroupBy(o => o.WalletId!.Value)
            .ToDictionary(g => g.Key, g => (g.First().Name!, g.First().Mobile ?? string.Empty));

        // Not cached when empty — that would be a failed lookup, not "no retailers".
        if (owners.Count > 0) cache.Set("wallet-owners", owners, TimeSpan.FromMinutes(10));
        return owners;
    }

    // clientId comes from the logged-in admin (MASTER_CLIENT_ID), never hardcoded —
    // unlike Transaction/Report this isn't scoped to one wallet, it's every retailer
    // on the client at once, so there's no walletId parameter here at all.
    [HttpGet("imps-report")]
    public async Task<ActionResult<List<AdminImpsReportRow>>> GetImpsReport(
        [FromQuery] int clientId, [FromQuery] string fromDate, [FromQuery] string toDate)
    {
        var result = await remoteApi.PostAsync<List<AdminImpsReportRow>>("Admin/ImpsTransferReport", new
        {
            Client_ID = MasterClient.Id,
            fromDate,
            toDate,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var rows = result.Data ?? [];
        if (rows.Count > 0)
        {
            var owners = await GetWalletOwnersAsync();
            foreach (var row in rows)
            {
                if (!owners.TryGetValue(row.WalletId, out var owner)) continue;
                if (string.IsNullOrWhiteSpace(row.CustomerName)) row.CustomerName = owner.Name;
                row.RetailerMobile = owner.Mobile;
            }
        }
        return Ok(rows);
    }

    [HttpGet("pg-report")]
    public async Task<ActionResult<List<AdminPgReportRow>>> GetPgReport(
        [FromQuery] int clientId, [FromQuery] string fromDate, [FromQuery] string toDate)
    {
        var result = await remoteApi.PostAsync<List<AdminPgReportRow>>("Admin/PgTransferReport", new
        {
            Client_ID = MasterClient.Id,
            fromDate,
            toDate,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data ?? []);
    }
}
