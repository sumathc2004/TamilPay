using System.Net.Http.Json;
using System.Text.Json;
using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController(RemoteApiClient remoteApi, IHttpClientFactory httpClientFactory) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    public async Task<ActionResult<DashboardSummary>> Get()
    {
        var result = await remoteApi.PostAsync<DashboardSummary>("Dashboard/Get", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
        });

        if (!result.IsSuccess || result.Data is not { } summary)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(summary);
    }

    /// <summary>
    /// Why the dashboard's wallet total and pipe balance differ: the same totals plus what moved
    /// today (card payments credited, IMPS and card-bill payments paid, failed and refunded).
    /// Admin dashboard only. Dashboard/Explain answers in a different envelope from the rest of
    /// the clients API — {"Status": true, "Data": …} rather than {"status": "success", "data": …} —
    /// so it is read here directly instead of through RemoteApiClient.
    /// </summary>
    [HttpGet("explain")]
    public async Task<ActionResult<DashboardExplain>> Explain()
    {
        try
        {
            var client = httpClientFactory.CreateClient("RemoteApi");
            using var response = await client.PostAsJsonAsync("Dashboard/Explain", new
            {
                Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            }, JsonOptions);

            using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            var root = doc.RootElement;

            // Status arrives as a real boolean here; tolerate the usual "success" string too.
            var ok = root.TryGetProperty("Status", out var status) || root.TryGetProperty("status", out status)
                ? status.ValueKind == JsonValueKind.True ||
                  (status.ValueKind == JsonValueKind.String && status.GetString()!.Equals("success", StringComparison.OrdinalIgnoreCase))
                : false;
            var message = root.TryGetProperty("Message", out var m) || root.TryGetProperty("message", out m) ? m.GetString() : null;

            if (!ok || !(root.TryGetProperty("Data", out var data) || root.TryGetProperty("data", out data)) || data.ValueKind != JsonValueKind.Object)
                return Problem(message ?? "Could not load the explanation.", statusCode: StatusCodes.Status502BadGateway);

            var explain = data.Deserialize<DashboardExplain>(JsonOptions);
            return explain is null
                ? Problem("Could not read the explanation.", statusCode: StatusCodes.Status502BadGateway)
                : Ok(explain);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return Problem($"Could not reach the server: {ex.Message}", statusCode: StatusCodes.Status502BadGateway);
        }
    }
}
