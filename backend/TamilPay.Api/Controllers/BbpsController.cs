using System.Globalization;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace TamilPay.Api.Controllers;

/// <summary>
/// Bill payments through the BBPS service. That service lives at its own addresses, set under
/// Bbps: in appsettings — it is not part of the clients API and does not share its envelope.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class BbpsController(
    IHttpClientFactory httpClientFactory, IConfiguration configuration, IMemoryCache cache, RemoteApiClient remoteApi,
    WalletOwnerDirectory walletOwners) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // Only categories this app offers are passed through, so the endpoint cannot be used
    // to query the BBPS service for anything else.
    private static readonly Dictionary<string, string> Categories = new(StringComparer.OrdinalIgnoreCase)
    {
        ["credit-card"] = "CREDIT CARD",
    };

    /// <summary>Every biller in a category, e.g. all credit card issuers.</summary>
    [HttpGet("billers")]
    public async Task<ActionResult<IEnumerable<Biller>>> GetBillers([FromQuery] string category = "credit-card")
    {
        if (!Categories.ContainsKey(category))
            return BadRequest(new { message = "Unknown bill category." });

        var (billers, error) = await LoadBillersAsync(category);
        return billers is null ? error! : Ok(billers);
    }

    /// <summary>
    /// Fetches the bill for one card — this is also the check that the card details are right:
    /// a wrong mobile/last-4 pair comes back as a failure from the biller.
    /// The parameter names are taken from the biller's own definition, never from the browser,
    /// so only that biller's fields can be sent and each goes out under its exact name.
    /// </summary>
    [HttpPost("fetch-bill")]
    public async Task<ActionResult<BillSummary>> FetchBill(FetchBillRequest request)
    {
        var url = configuration["Bbps:FetchBillUrl"];
        if (string.IsNullOrWhiteSpace(url))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Bill fetch is not connected yet. Set Bbps:FetchBillUrl in appsettings.json." });

        var (billers, error) = await LoadBillersAsync("credit-card");
        if (billers is null) return error!;

        var biller = billers.FirstOrDefault(b => b.BillerId == request.BillerId);
        if (biller is null)
            return BadRequest(new { message = "Unknown biller." });

        var custParam = new List<object>();
        foreach (var param in biller.CustomerParams)
        {
            request.Values.TryGetValue(param.ParamName, out var raw);
            var value = (raw ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                if (param.Optional) continue;
                return BadRequest(new { message = $"{param.ParamName} is required." });
            }
            if (value.Length > 64)
                return BadRequest(new { message = $"{param.ParamName} is too long." });
            custParam.Add(new { name = param.ParamName, value });
        }

        // The BBPS service wants a unique reference per fetch; it accepts one we generate.
        var reference = $"TPAY{DateTime.UtcNow:yyyyMMddHHmmssfff}{Convert.ToHexString(RandomNumberGenerator.GetBytes(6))}";

        try
        {
            var client = httpClientFactory.CreateClient("Bbps");
            using var response = await client.PostAsJsonAsync(url, new { reference, billerId = biller.BillerId, custParam }, JsonOptions);
            var envelope = await response.Content.ReadFromJsonAsync<BbpsEnvelope<JsonElement>>(JsonOptions);

            // "Payment received for the billing period - no bill due" also arrives as status
            // false, but it is the opposite of a failure: the card matched and is fully paid.
            // It is answered as a result of its own so the page can say so plainly.
            if (envelope is { Status: false } && IsNoBillDue(envelope.Message))
                return Ok(new BillSummary
                {
                    Reference = reference,
                    BillerId = biller.BillerId,
                    BillerName = biller.BillerName,
                    NoBillDue = true,
                    Message = envelope.Message,
                });

            // A wrong card/mobile pair is the biller saying no, not a fault on our side — the
            // message ("Invalid combination of customer parameters") is shown to the person.
            if (envelope is null || !envelope.Status)
                return UnprocessableEntity(new { message = envelope?.Message ?? "Could not fetch the bill." });

            var summary = BillSummary.From(envelope.Data, biller, reference);

            // Kept server-side so the payment cannot be pointed at a different card, mobile or
            // name than the bill that was fetched: Pay takes only this reference and an amount.
            cache.Set(FetchKey(reference), new FetchedBill
            {
                BillerId = biller.BillerId,
                Mobile = ValueOfKind(biller, request, "mobile"),
                CardNumber = ValueOfKind(biller, request, "card"),
                CustomerName = summary.CustomerName ?? string.Empty,
                MinPayable = summary.MinPayable,
                MaxPayable = summary.MaxPayable,
                FetchId = summary.FetchId,
                CustParam = custParam,
            }, TimeSpan.FromMinutes(30));

            return Ok(summary);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return Problem($"Could not reach the biller service: {ex.Message}", statusCode: StatusCodes.Status502BadGateway);
        }
    }

    // Payments in flight, by reference — a double click must not pay twice.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, byte> InFlight = new();

    /// <summary>
    /// Pays a fetched credit card bill from the retailer's wallet. Everything about the card
    /// (biller, mobile, last 4, name) comes from the bill fetched under this reference; the
    /// browser supplies only the reference, the wallet and the amount, and the amount must sit
    /// inside the bill's limits. A reference can be paid once.
    /// </summary>
    [HttpPost("pay")]
    public async Task<IActionResult> Pay(PayBillRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Reference) || !cache.TryGetValue<FetchedBill>(FetchKey(request.Reference), out var bill) || bill is null)
            return BadRequest(new { message = "This bill has expired. Fetch the bill again to pay." });

        if (cache.TryGetValue(PaidKey(request.Reference), out _))
            return Conflict(new { message = "This bill has already been paid." });

        if (request.WalletId <= 0)
            return BadRequest(new { message = "No wallet is linked to this account." });

        var amount = decimal.Round(request.Amount, 2);
        if (amount <= 0 || amount != request.Amount)
            return BadRequest(new { message = "Enter a valid amount." });
        if (bill.MinPayable is { } min && amount < min)
            return BadRequest(new { message = $"The least you can pay is ₹{min:N2}." });
        if (bill.MaxPayable is { } max && amount > max)
            return BadRequest(new { message = $"The most you can pay is ₹{max:N2}." });

        if (!InFlight.TryAdd(request.Reference, 0))
            return Conflict(new { message = "This payment is already being processed." });

        try
        {
            var result = await remoteApi.PostAsync<JsonElement?>("Bbps/CreditCard/Pay", new
            {
                Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
                walletId = request.WalletId,
                amount,
                billerId = bill.BillerId,
                mobile = bill.Mobile,
                cardNumber = bill.CardNumber,
                customerName = bill.CustomerName,
                reference_id = request.Reference,
                // The same identifiers the bill was fetched with, under the biller's own field
                // names ("Registered Mobile Number", "Last 4 digits of Credit Card Number"…) —
                // each bank names them differently, and the BBPS network rejects the payment
                // ("Invalid input", answering with its field list) when they do not match.
                custParam = bill.CustParam,
                fetchId = bill.FetchId,
            });

            if (!result.IsSuccess)
                return UnprocessableEntity(new { message = string.IsNullOrWhiteSpace(result.Message) ? "The payment did not go through." : result.Message });

            cache.Set(PaidKey(request.Reference), true, TimeSpan.FromHours(24));
            return Ok(new { message = result.Message, amount, reference = request.Reference, data = result.Data });
        }
        finally
        {
            InFlight.TryRemove(request.Reference, out _);
        }
    }

    private static readonly HashSet<string> ReportStatuses = new(StringComparer.OrdinalIgnoreCase) { "SUCCESS", "FAILED", "PENDING" };

    /// <summary>
    /// Credit card bill payments over a date range — one row per wallet entry: the DEBIT for a
    /// payment and, when it failed, the CREDIT that refunded it. walletId 0 is every wallet on
    /// the client (admins); status is optional (SUCCESS / FAILED / PENDING).
    /// </summary>
    [HttpGet("report")]
    public async Task<IActionResult> Report([FromQuery] int walletId, [FromQuery] string fromDate, [FromQuery] string toDate, [FromQuery] string? status = null)
    {
        if (!DateOnly.TryParse(fromDate, CultureInfo.InvariantCulture, out _) || !DateOnly.TryParse(toDate, CultureInfo.InvariantCulture, out _))
            return BadRequest(new { message = "Choose a valid date range." });
        if (!string.IsNullOrWhiteSpace(status) && !ReportStatuses.Contains(status))
            return BadRequest(new { message = "Unknown status." });

        var result = await remoteApi.PostAsync<List<JsonElement>>("Bbps/CreditCard/Report", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId,
            fromDate,
            toDate,
            status = string.IsNullOrWhiteSpace(status) ? null : status.ToUpperInvariant(),
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(await walletOwners.WithShopAsync(result.Data));
    }

    private static string FetchKey(string reference) => $"bbps-fetch:{reference}";
    private static string PaidKey(string reference) => $"bbps-paid:{reference}";

    // The value typed for the biller's mobile or last-4 field, found by what the field means —
    // each biller names them differently ("Mobile Number", "Registered Mobile No"…).
    private static string ValueOfKind(Biller biller, FetchBillRequest request, string kind)
    {
        foreach (var param in biller.CustomerParams)
        {
            var name = param.ParamName.ToLowerInvariant();
            var matches = kind == "mobile"
                ? name.Contains("mobile")
                : System.Text.RegularExpressions.Regex.IsMatch(name, @"last\s*4|4\s*digit");
            if (matches && request.Values.TryGetValue(param.ParamName, out var value))
                return (value ?? string.Empty).Trim();
        }
        return string.Empty;
    }

    // The wordings billers use for "nothing to pay this cycle".
    private static bool IsNoBillDue(string? message) =>
        !string.IsNullOrWhiteSpace(message) &&
        System.Text.RegularExpressions.Regex.IsMatch(message,
            @"no\s+bill\s+due|payment\s+received|no\s+dues?\b|bill\s+(already\s+)?paid|no\s+(outstanding|pending)\s+(amount|bill)",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    // The biller list rarely changes and the fetch needs it to look parameter names up, so it
    // is kept for an hour rather than requested on every call.
    private async Task<(List<Biller>? Billers, ActionResult? Error)> LoadBillersAsync(string category)
    {
        var cacheKey = $"bbps-billers:{category}";
        if (cache.TryGetValue<List<Biller>>(cacheKey, out var cached) && cached is not null)
            return (cached, null);

        var url = configuration["Bbps:BillersUrl"];
        if (string.IsNullOrWhiteSpace(url))
            return (null, StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Card payments are not connected yet. Set Bbps:BillersUrl in appsettings.json." }));

        try
        {
            var client = httpClientFactory.CreateClient("Bbps");
            using var response = await client.PostAsJsonAsync(url, new { biller = Categories[category] }, JsonOptions);
            var envelope = await response.Content.ReadFromJsonAsync<BbpsEnvelope<List<Biller>>>(JsonOptions);

            if (envelope is null || !envelope.Status)
                return (null, Problem(envelope?.Message ?? $"Biller list request failed ({(int)response.StatusCode}).",
                    statusCode: StatusCodes.Status502BadGateway));

            var billers = (envelope.Data ?? []).OrderBy(b => b.BillerName, StringComparer.OrdinalIgnoreCase).ToList();
            cache.Set(cacheKey, billers, TimeSpan.FromHours(1));
            return (billers, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return (null, Problem($"Could not reach the biller service: {ex.Message}", statusCode: StatusCodes.Status502BadGateway));
        }
    }
}

/// <summary>What the browser sends to pay: which fetched bill, from which wallet, how much.</summary>
public class PayBillRequest
{
    public string Reference { get; set; } = string.Empty;
    public int WalletId { get; set; }
    public decimal Amount { get; set; }
}

/// <summary>A fetched bill as kept on the server for paying it.</summary>
internal class FetchedBill
{
    public string BillerId { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string CardNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public decimal? MinPayable { get; set; }
    public decimal? MaxPayable { get; set; }
    public string? FetchId { get; set; }
    public List<object> CustParam { get; set; } = [];
}

/// <summary>What the browser sends to fetch a bill: the biller and a value per field name.</summary>
public class FetchBillRequest
{
    public string BillerId { get; set; } = string.Empty;
    public Dictionary<string, string?> Values { get; set; } = [];
}

/// <summary>The fetched bill, flattened for the page. Amounts arrive from the BBPS service as a
/// mix of strings and numbers, so they are read leniently and returned as numbers.</summary>
public class BillSummary
{
    public string Reference { get; set; } = string.Empty;
    public string? FetchId { get; set; }
    public string BillerId { get; set; } = string.Empty;
    public string BillerName { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public decimal? TotalDue { get; set; }
    public decimal? MinimumDue { get; set; }
    public decimal? MaxPayable { get; set; }
    public decimal? MinPayable { get; set; }
    public string? DueDate { get; set; }
    public string? BillDate { get; set; }

    /// <summary>The card matched but has nothing to pay this cycle; Message carries the biller's wording.</summary>
    public bool NoBillDue { get; set; }
    public string? Message { get; set; }

    public static BillSummary From(JsonElement data, Biller biller, string reference)
    {
        var details = data.ValueKind == JsonValueKind.Object && data.TryGetProperty("billDetails", out var d) ? d : default;
        var tags = data.ValueKind == JsonValueKind.Object && data.TryGetProperty("additionalData", out var a)
            && a.ValueKind == JsonValueKind.Object && a.TryGetProperty("tag", out var t) && t.ValueKind == JsonValueKind.Array
            ? t.EnumerateArray().ToList() : [];

        decimal? Tag(string name) => Number(tags.FirstOrDefault(x =>
            x.TryGetProperty("name", out var n) && string.Equals(n.GetString(), name, StringComparison.OrdinalIgnoreCase)), "value");

        return new BillSummary
        {
            Reference = Text(data, "reference") ?? reference,
            FetchId = Text(data, "fetchId"),
            BillerId = biller.BillerId,
            BillerName = biller.BillerName,
            CustomerName = Text(details, "customerName")?.Replace("  ", " ").Trim(),
            TotalDue = Number(details, "amount") ?? Number(data, "amount"),
            MinimumDue = Tag("Minimum Amount Due"),
            MaxPayable = Tag("Maximum Permissible Amount"),
            MinPayable = Number(data, "minAmount"),
            DueDate = Text(details, "dueDate"),
            BillDate = Text(details, "billDate"),
        };
    }

    private static string? Text(JsonElement obj, string name) =>
        obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() : null;

    private static decimal? Number(JsonElement obj, string name)
    {
        if (obj.ValueKind != JsonValueKind.Object || !obj.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String &&
            decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var s)) return s;
        return null;
    }
}
