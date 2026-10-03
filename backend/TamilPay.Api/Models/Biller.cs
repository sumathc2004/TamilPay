using System.Text.Json.Serialization;

namespace TamilPay.Api.Models;

/// <summary>The BBPS service's own envelope — unlike the clients API it uses a boolean
/// status and camelCase statusCode: {status, statusCode, data, message, count}.</summary>
public class BbpsEnvelope<TData>
{
    public bool Status { get; set; }
    public int StatusCode { get; set; }
    public string? Message { get; set; }
    public TData? Data { get; set; }
}

/// <summary>One biller (e.g. "HDFC Credit Card") as the BBPS service returns it.</summary>
public class Biller
{
    public string Category { get; set; } = string.Empty;
    public string BillerId { get; set; } = string.Empty;
    public string BillerName { get; set; } = string.Empty;

    [JsonPropertyName("customerparams")]
    public List<BillerParam> CustomerParams { get; set; } = [];
}

/// <summary>An input the biller needs to identify the customer — e.g. "Registered Mobile
/// Number", NUMERIC. Names vary per biller, so the form is built from these.</summary>
public class BillerParam
{
    public string ParamName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public bool Optional { get; set; }
    public List<string>? Values { get; set; }
}
