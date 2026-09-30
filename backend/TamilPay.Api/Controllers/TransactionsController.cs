using System.Text.Json.Serialization;
using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TransactionsController(RemoteApiClient remoteApi) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(TransactionRequest request)
    {
        var walletResult = await remoteApi.PostAsync<List<WalletCredentials>>("wallet/SelectByCustomerId", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            CustomerId = request.CustomerId,
        });

        if (!walletResult.IsSuccess || walletResult.Data?.FirstOrDefault() is not { } wallet)
            return Problem("No wallet found for this account.", statusCode: StatusCodes.Status502BadGateway);

        if (request.Amount > wallet.CurrentBalance)
            return BadRequest(new { message = "Insufficient balance." });

        var result = await remoteApi.PostAsync<int?>("Transaction/Insert", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId = wallet.WalletId,
            senderId = request.SenderId,
            bankAccountId = request.BankAccountId,
            Amount = request.Amount,
            username = wallet.Username,
            Password = wallet.Password,
            Passpin = request.Pin,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = "Transfer submitted.", transactionId = result.Data });
    }

    // Always today — the frontend has no date picker for this by design.
    [HttpGet("today")]
    public async Task<ActionResult<List<TransactionReportItem>>> GetTodayReport([FromQuery] int walletId)
    {
        var today = DateTime.Now.ToString("yyyy-MM-dd");
        var result = await remoteApi.PostAsync<List<TransactionReportItem>>("Transaction/Report", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId,
            fromDate = today,
            toDate = today,
        });

        return Ok(result.Data ?? []);
    }

    // General-purpose report with a caller-chosen date range, for the Reports page.
    [HttpGet("report")]
    public async Task<ActionResult<List<TransactionReportItem>>> GetReport(
        [FromQuery] int walletId, [FromQuery] string fromDate, [FromQuery] string toDate)
    {
        var result = await remoteApi.PostAsync<List<TransactionReportItem>>("Transaction/Report", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId,
            fromDate,
            toDate,
        });

        return Ok(result.Data ?? []);
    }

    // Every debit/credit on the wallet over a caller-chosen date range, for the Ledger report.
    [HttpGet("ledger")]
    public async Task<ActionResult<List<LedgerEntry>>> GetLedger(
        [FromQuery] int walletId, [FromQuery] string fromDate, [FromQuery] string toDate)
    {
        var result = await remoteApi.PostAsync<List<LedgerEntry>>("Wallet/Ledger", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId,
            fromDate,
            toDate,
        });

        return Ok(result.Data ?? []);
    }

    /// <summary>
    /// wallet/SelectByCustomerId's raw record — including the wallet's own Username/Password/Passpin,
    /// which Transaction/Insert re-authenticates with. Kept private to this controller so it can
    /// never be serialized back out through any public action (unlike Models/Wallet.cs, which
    /// deliberately omits these fields for that reason).
    /// </summary>
    private class WalletCredentials
    {
        [JsonPropertyName("Id")]
        public int WalletId { get; set; }

        [JsonPropertyName("username")]
        public string Username { get; set; } = string.Empty;

        [JsonPropertyName("Password")]
        public string Password { get; set; } = string.Empty;

        [JsonPropertyName("currentBalance")]
        public decimal CurrentBalance { get; set; }
    }
}
