using System.Net.Http.Json;
using System.Text.Json;
using TamilPay.Api.Models;

namespace TamilPay.Api.Services;

/// <summary>
/// Thin wrapper around the remote Client/Customer API at 172.198.160.73 — every
/// action there (even reads) is a POST that returns the same {status, data} envelope.
/// </summary>
public class RemoteApiClient(IHttpClientFactory httpClientFactory)
{
    private const string ClientName = "RemoteApi";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<RemoteApiEnvelope<TData>> PostAsync<TData>(string path, object? body = null)
    {
        var client = httpClientFactory.CreateClient(ClientName);
        var response = await client.PostAsJsonAsync(path, body ?? new { }, JsonOptions);

        // A route that doesn't exist upstream yet (e.g. not deployed) comes back as a
        // non-2xx status with an empty/non-JSON body, which ReadFromJsonAsync can't
        // parse — that's a normal "this call failed" case, not a bug in our code, so
        // it's reported the same way as any other remote failure instead of throwing.
        RemoteApiEnvelope<TData>? envelope;
        try
        {
            envelope = await response.Content.ReadFromJsonAsync<RemoteApiEnvelope<TData>>(JsonOptions);
        }
        catch (JsonException)
        {
            return new RemoteApiEnvelope<TData>
            {
                Status = "failure",
                StatusCode = (int)response.StatusCode,
                Message = response.IsSuccessStatusCode
                    ? "Remote API returned a response we couldn't parse."
                    : $"Remote API request failed ({(int)response.StatusCode} {response.StatusCode}).",
            };
        }

        return envelope ?? new RemoteApiEnvelope<TData> { Status = "failure", Message = "Empty response from remote API." };
    }
}
