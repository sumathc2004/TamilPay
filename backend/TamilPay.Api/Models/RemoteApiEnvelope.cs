namespace TamilPay.Api.Models;

/// <summary>Every response from the remote API is wrapped in this shape: {status, statuscode, message, data}.</summary>
public class RemoteApiEnvelope<TData>
{
    public string Status { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string Message { get; set; } = string.Empty;
    public TData? Data { get; set; }

    public bool IsSuccess => Status.Equals("success", StringComparison.OrdinalIgnoreCase);
}
