using System.Text.Json;
using System.Text.Json.Nodes;
using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

/// <summary>
/// Static QR provisioning — Home > Pay In > Static QR pulls the next available QR
/// code from the client's pool. The pool is finite with a daily limit; "No QR
/// available or daily limit exhausted" is a normal business response when it's
/// empty, not an upstream failure, so that message is passed straight through
/// rather than turned into a 502.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class QrController(RemoteApiClient remoteApi, WalletOwnerDirectory walletOwners) : ControllerBase
{
    // clientId comes from the logged-in user (MASTER_CLIENT_ID), never hardcoded.
    //
    // Like customer/SelectById and wallet/Login, GetNext's "data" comes back as a
    // single-element array rather than a bare object — confirmed directly once the
    // QR pool actually had something in it (it was empty every earlier check, so
    // this only surfaced once real data existed). Unwrapping it here, the same way
    // those other endpoints do, instead of passing the array straight through.
    [HttpPost]
    public async Task<IActionResult> GetNext([FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<List<JsonElement>>("Qr/GetNext", new
        {
            Client_ID = MasterClient.Id,
        });

        // JsonElement is a struct — FirstOrDefault() on an empty list returns a valid
        // (if meaningless) default value, never null, so an explicit Count check is
        // used here instead of the FirstOrDefault-is-not-null pattern other single-row
        // endpoints use for reference-typed models.
        if (!result.IsSuccess || result.Data is not { Count: > 0 } list)
            return NotFound(new { message = result.Message });

        return Ok(list[0]);
    }

    /// <summary>Creates a UPI collect request against a previously pulled QR
    /// (its QrId/Vpa pair, from GetNext), for a given amount and UTR.</summary>
    [HttpPost("request")]
    public async Task<IActionResult> InsertRequest(QrRequestInsertRequest request)
    {
        var result = await remoteApi.PostAsync<JsonElement?>("Qr/Request/Insert", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId = request.WalletId,
            QrId = request.QrId,
            Vpa = request.Vpa,
            Amount = request.Amount,
            UTR = request.Utr,
            Remarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim(),
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = result.Message, data = result.Data });
    }

    /// <summary>
    /// Every collect request created against this client/wallet's QR codes. Like
    /// Transaction/Report and pg/TransferReport, walletId 0 pools every wallet on
    /// the client together — used for admins. Row shape is passed through as raw
    /// JSON: no request has ever actually gone through yet (the QR pool has been
    /// empty every time this was tested), so there's no real row to shape a model
    /// against — the frontend reads fields defensively instead.
    /// </summary>
    [HttpGet("report")]
    public async Task<IActionResult> GetReport([FromQuery] int walletId)
    {
        var result = await remoteApi.PostAsync<List<JsonElement>>("Qr/Request/Report", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            walletId,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data ?? []);
    }

    /// <summary>
    /// Every QR code on file for the client — Admin > QR's landing view. Row shape is
    /// passed through as raw JSON: the pool has been empty for this client every
    /// single time any Qr/* endpoint was checked, so there's no real row to shape a
    /// model against — the frontend reads fields defensively instead.
    /// </summary>
    [HttpGet("all")]
    public async Task<IActionResult> GetAll([FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<List<JsonElement>>("Qr/SelectAll", new
        {
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data ?? []);
    }

    /// <summary>Provisions a new static QR code — Admin > QR > Add New.</summary>
    [HttpPost("insert")]
    public async Task<IActionResult> Insert(QrInsertRequest request)
    {
        var result = await remoteApi.PostAsync<JsonElement?>("Qr/Insert", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            QrName = request.QrName,
            Vpa = request.Vpa,
            ChargeType = request.ChargeType,
            ChargeValue = request.ChargeValue,
            MinCharge = request.MinCharge,
            DailyMaxLimit = request.DailyMaxLimit,
            DisplayOrder = request.DisplayOrder,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = result.Message, data = result.Data });
    }

    /// <summary>
    /// Every QR collect request across the whole client, regardless of wallet —
    /// Admin > QR Requests' "All Requests" section. Unlike GetReport above (which
    /// scopes to one wallet, or 0 to pool every wallet), this calls Qr/Request/Report
    /// with just Client_ID, matching what the remote API itself expects for the
    /// client-wide admin view.
    /// </summary>
    [HttpGet("admin-report")]
    public async Task<IActionResult> GetAdminReport()
    {
        var result = await remoteApi.PostAsync<List<JsonElement>>("Qr/Request/Report", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(await walletOwners.WithShopAsync(result.Data));
    }

    /// <summary>Every QR collect request awaiting admin approval — Admin > QR Requests'
    /// "Pending Approval" section.</summary>
    [HttpGet("pending")]
    public async Task<IActionResult> GetPending()
    {
        var result = await remoteApi.PostAsync<List<JsonElement>>("Qr/Request/Pending", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(await walletOwners.WithShopAsync(result.Data));
    }


    [HttpPost("approve")]
    public async Task<IActionResult> Approve(QrRequestActionRequest request)
    {
        var result = await remoteApi.PostAsync<JsonElement?>("Qr/Request/Approve", new
        {
            Id = request.Id,
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = result.Message });
    }

    [HttpPost("reject")]
    public async Task<IActionResult> Reject(QrRequestRejectRequest request)
    {
        var result = await remoteApi.PostAsync<JsonElement?>("Qr/Request/Reject", new
        {
            Id = request.Id,
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
            remarks = request.Remarks,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = result.Message });
    }
}
