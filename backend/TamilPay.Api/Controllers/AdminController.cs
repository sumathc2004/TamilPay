using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;


using TamilPay.Api;

namespace TamilPay.Api.Controllers;

/// <summary>Admin-only, client-wide reports — as opposed to TransactionsController's
/// per-wallet reports. Mirrors the remote Admin/* namespace.</summary>
[ApiController]
[Route("api/[controller]")]
public class AdminController(RemoteApiClient remoteApi, WalletOwnerDirectory walletOwners) : ControllerBase
{
    // The remote's IMPS report names no retailer (customerName comes back null) — only a
    // walletId. Wallet -> retailer is resolved by the shared WalletOwnerDirectory (also used by
    // the QR request lists), which caches it since it takes one remote call per customer.
    private Task<Dictionary<int, WalletOwner>> GetWalletOwnersAsync() => walletOwners.GetAsync();

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
                row.StoreName = owner.Store;
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

    // Refunds in flight, by transaction id — a double click must not refund twice.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<int, byte> RefundsInFlight = new();

    /// <summary>
    /// Refunds one transaction (an Admin IMPS report row) back to its wallet, whatever its status —
    /// the remote decides whether that transaction can be refunded and says why not when it can't.
    /// The client is always the master client, never taken from the request.
    /// </summary>
    [HttpPost("refund")]
    public async Task<IActionResult> Refund(RefundRequest request)
    {
        if (request.Id <= 0)
            return BadRequest(new { message = "Choose a transaction to refund." });

        var remarks = string.IsNullOrWhiteSpace(request.Remarks) ? "Refunded by admin" : request.Remarks.Trim();

        if (!RefundsInFlight.TryAdd(request.Id, 0))
            return Conflict(new { message = "This refund is already being processed." });

        try
        {
            var result = await remoteApi.PostAsync<System.Text.Json.JsonElement?>("Transaction/Refund", new
            {
                request.Id,
                Client_ID = MasterClient.Id,
                remarks,
            });

            if (!result.IsSuccess)
                return UnprocessableEntity(new { message = string.IsNullOrWhiteSpace(result.Message) ? "The refund did not go through." : result.Message });

            return Ok(new { message = string.IsNullOrWhiteSpace(result.Message) ? "Refund successful." : result.Message, id = request.Id });
        }
        finally
        {
            RefundsInFlight.TryRemove(request.Id, out _);
        }
    }
}
