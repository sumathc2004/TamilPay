using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

/// <summary>Customer-facing PG browsing (Home → Pay In → PG), as opposed to
/// PgSettingsController which is the admin CRUD for Groups/Categories/PGs/Settlements.</summary>
[ApiController]
[Route("api/[controller]")]
public class PgController(RemoteApiClient remoteApi, IConfiguration configuration, Microsoft.Extensions.Caching.Memory.IMemoryCache cache) : ControllerBase
{
    // clientId and walletId both come from the logged-in user (MASTER_CLIENT_ID and
    // user.walletId) — never hardcoded, so each retailer only ever sees the PGs actually
    // mapped to their own wallet.
    [HttpGet("by-wallet")]
    public async Task<ActionResult<IEnumerable<PgWalletRow>>> GetByWallet([FromQuery] int clientId, [FromQuery] int walletId)
    {
        var result = await remoteApi.PostAsync<List<PgWalletRow>>("Pg/SelectByWallet", new
        {
            Client_ID = MasterClient.Id,
            walletId,
        });

        if (!result.IsSuccess)
        {
            // "No PGs mapped for this wallet" is a normal empty state (confirmed by calling
            // it directly with a wallet that has none), not a real upstream failure — treat
            // it as an empty list so the frontend shows its usual "nothing yet" state
            // instead of an error banner.
            if (result.Message.Contains("No PGs mapped", StringComparison.OrdinalIgnoreCase))
                return Ok(Array.Empty<PgWalletRow>());

            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);
        }

        return Ok(result.Data ?? []);
    }

    // clientId and walletId both come from the logged-in user — never hardcoded.
    // redirectURL sends the payer back to the wallet ledger, which shows the result of the
    // payment they just made (looked up by the token below). Pg:RedirectUrl overrides the host (e.g. https://tamilpay.in);
    // left empty, it is this request's own origin, so the same build works on any host.
    [HttpPost("generate-link")]
    public async Task<ActionResult<PgGenerateLinkResult>> GenerateLink(PgGenerateLinkRequest request)
    {
        // The reference does not exist until the link does, so it cannot be put in the
        // redirect URL. A random token goes in instead, and is tied to the reference once
        // the upstream has issued it.
        var token = Guid.NewGuid().ToString("N");

        var result = await remoteApi.PostAsync<PgGenerateLinkResult>("pg/GenerateLink", new
        {
            Client_ID = MasterClient.Id,
            walletId = request.WalletId,
            pgCode = request.PgCode,
            custName = request.CustomerName,
            card_last_4_digit = request.CardLast4,
            amount = request.Amount,
            redirectURL = $"{RedirectBase()}/wallet-settlement?t={token}",
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var reference = result.Data?.RefNo;
        if (string.IsNullOrWhiteSpace(reference) && Uri.TryCreate(result.Data?.PgLink, UriKind.Absolute, out var link))
            reference = System.Web.HttpUtility.ParseQueryString(link.Query)["referenceNumber"];
        if (!string.IsNullOrWhiteSpace(reference))
            cache.Set(TokenKey(token), reference, TimeSpan.FromHours(24));

        return Ok(result.Data);
    }

    private static string TokenKey(string token) => $"pg-status-token:{token}";

    private string RedirectBase()
    {
        var configured = configuration["Pg:RedirectUrl"];
        return string.IsNullOrWhiteSpace(configured)
            ? $"{Request.Scheme}://{Request.Host}"
            : configured.Trim().TrimEnd('/');
    }

    private static readonly string[] SuccessStates = ["SUCCESS", "SUCCESSFUL", "SUCCEEDED", "COMPLETED", "PAID", "CAPTURED"];
    private static readonly string[] FailedStates = ["FAILED", "FAILURE", "DECLINED", "CANCELLED", "CANCELED", "REJECTED", "EXPIRED"];

    /// <summary>
    /// Payment status for the page the payer lands on after the gateway. Public on
    /// purpose — the payer is not signed in — so it answers only for a reference that
    /// belongs to the master client: CheckStatus itself is not client-scoped and would
    /// otherwise confirm any client's payment to anyone who guessed a number. That same
    /// lookup supplies the card digits, which CheckStatus does not return.
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<PgStatusResponse>> GetStatus([FromQuery] string? referenceId, [FromQuery] string? token)
    {
        // Arriving from the gateway, the payer has only the token from the redirect URL.
        if (string.IsNullOrWhiteSpace(referenceId) && !string.IsNullOrWhiteSpace(token))
        {
            if (!cache.TryGetValue<string>(TokenKey(token.Trim()), out var fromToken) || fromToken is null)
                return NotFound(new { message = "This link has expired. Enter your reference number to check the payment." });
            referenceId = fromToken;
        }

        var reference = referenceId?.Trim() ?? string.Empty;
        if (!System.Text.RegularExpressions.Regex.IsMatch(reference, "^[A-Za-z0-9_-]{6,64}$"))
            return BadRequest(new { message = "Enter a valid reference number." });

        var report = await remoteApi.PostAsync<List<PgTransferReportRow>>("pg/TransferReport", new
        {
            Client_ID = MasterClient.Id,
            walletId = 0,
            fromDate = DateTime.UtcNow.AddDays(-365).ToString("yyyy-MM-dd"),
            toDate = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd"),
        });
        if (!report.IsSuccess)
            return Problem(report.Message, statusCode: StatusCodes.Status502BadGateway);

        var owned = report.Data?.FirstOrDefault(r =>
            string.Equals(r.PipeRefNumber, reference, StringComparison.OrdinalIgnoreCase));
        if (owned is null)
            return NotFound(new { message = "We couldn't find a payment with that reference number." });

        var response = new PgStatusResponse
        {
            ReferenceId = reference,
            Amount = owned.Amount,
            CardNumber = string.IsNullOrWhiteSpace(owned.CardNumber) ? null : owned.CardNumber,
        };

        var check = await remoteApi.PostAsync<PgVendorStatus>("Pg/CheckStatus", new { reference_id = reference });
        if (!check.IsSuccess || check.Data is null)
        {
            // "Transaction not found in vendor" — the link exists but the payer never got
            // as far as paying. That is a state, not an error.
            response.Message = "This payment has not been completed yet.";
            return Ok(response);
        }

        var vendor = check.Data;
        var state = (vendor.VendorStatus ?? string.Empty).Trim().ToUpperInvariant();
        response.Utr = string.IsNullOrWhiteSpace(vendor.Utr) ? null : vendor.Utr;
        response.Amount = vendor.Amount ?? owned.Amount;
        response.ClosingBalance = vendor.WalletClosingBalance ?? owned.WalletClosingBalance;

        if (vendor.Credited || SuccessStates.Contains(state))
        {
            response.Outcome = "success";
            response.Message = "Payment successful.";
        }
        else if (FailedStates.Contains(state))
        {
            response.Outcome = "failed";
            response.Message = "Payment failed. No amount was debited.";
        }
        else
        {
            response.Message = "Payment is still being processed.";
        }

        return Ok(response);
    }

    // clientId and walletId both come from the logged-in user — never hardcoded. The
    // frontend only shows this report to Retailer logins, since it's their own wallet's
    // PG link history.
    [HttpGet("transfer-report")]
    public async Task<ActionResult<IEnumerable<PgTransferReportRow>>> GetTransferReport(
        [FromQuery] int clientId, [FromQuery] int walletId, [FromQuery] string fromDate, [FromQuery] string toDate)
    {
        var result = await remoteApi.PostAsync<List<PgTransferReportRow>>("pg/TransferReport", new
        {
            Client_ID = MasterClient.Id,
            walletId,
            fromDate,
            toDate,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data ?? []);
    }
}
