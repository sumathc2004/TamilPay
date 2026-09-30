using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

/// <summary>Admin-only, client-wide reports — as opposed to TransactionsController's
/// per-wallet reports. Mirrors the remote Admin/* namespace.</summary>
[ApiController]
[Route("api/[controller]")]
public class AdminController(RemoteApiClient remoteApi) : ControllerBase
{
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

        return Ok(result.Data ?? []);
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
