using System.Text.Json;
using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

/// <summary>
/// Announcements shown to every customer (popup once a day + the home banner) and managed
/// by admins. Rows are passed through as the remote returns them
/// (Id, title, message, isActive, createdTime, updatedTime). The app has no server-side
/// sessions, so "admin only" for create/edit is enforced by the UI, like the rest of Admin.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AnnouncementsController(RemoteApiClient remoteApi) : ControllerBase
{
    // Announcement/Select ignores its isActive filter — it returns every announcement for the
    // client whichever value is sent (checked: asking for isActive=false still returns an active
    // row). So everything is fetched once and filtered here, and rows are de-duplicated by Id.
    private async Task<(bool Ok, string? Message, List<JsonElement> Rows)> SelectAllAsync()
    {
        var result = await remoteApi.PostAsync<List<JsonElement>>("Announcement/Select", new
        {
            Client_ID = MasterClient.Id, // The one tenant this app serves; never taken from the request.
        });
        if (!result.IsSuccess) return (false, result.Message, []);

        static int IdOf(JsonElement e) =>
            e.TryGetProperty("Id", out var id) && id.TryGetInt32(out var n) ? n : -1;
        static string Created(JsonElement e) =>
            e.TryGetProperty("createdTime", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() ?? "" : "";

        var rows = (result.Data ?? [])
            .GroupBy(IdOf)
            .Select(g => g.First())
            .OrderByDescending(Created)
            .ToList();
        return (true, null, rows);
    }

    private static bool IsActive(JsonElement e) =>
        !e.TryGetProperty("isActive", out var a) || a.ValueKind != JsonValueKind.False;

    /// <summary>Active announcements — what every customer sees.</summary>
    [HttpGet]
    public async Task<IActionResult> GetActive()
    {
        var (ok, message, rows) = await SelectAllAsync();
        return ok ? Ok(rows.Where(IsActive).ToList()) : Problem(message, statusCode: StatusCodes.Status502BadGateway);
    }

    /// <summary>Every announcement, active or not, newest first — for the admin's manage page.</summary>
    [HttpGet("all")]
    public async Task<IActionResult> GetAll()
    {
        var (ok, message, rows) = await SelectAllAsync();
        return ok ? Ok(rows) : Problem(message, statusCode: StatusCodes.Status502BadGateway);
    }

    [HttpPost]
    public async Task<IActionResult> Create(AnnouncementRequest request)
    {
        var result = await remoteApi.PostAsync<JsonElement?>("Announcement/Insert", new
        {
            Client_ID = MasterClient.Id,
            title = request.Title.Trim(),
            message = request.Message.Trim(),
            isActive = request.IsActive,
        });

        if (!result.IsSuccess)
            return UnprocessableEntity(new { message = string.IsNullOrWhiteSpace(result.Message) ? "The announcement could not be saved." : result.Message });

        return Ok(new { message = string.IsNullOrWhiteSpace(result.Message) ? "Announcement added." : result.Message });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, AnnouncementRequest request)
    {
        var result = await remoteApi.PostAsync<JsonElement?>("Announcement/Update", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
            title = request.Title.Trim(),
            message = request.Message.Trim(),
            isActive = request.IsActive,
        });

        if (!result.IsSuccess)
            return UnprocessableEntity(new { message = string.IsNullOrWhiteSpace(result.Message) ? "The announcement could not be updated." : result.Message });

        return Ok(new { message = string.IsNullOrWhiteSpace(result.Message) ? "Announcement updated." : result.Message });
    }
}
