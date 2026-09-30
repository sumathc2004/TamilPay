using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PgSettingsController(RemoteApiClient remoteApi) : ControllerBase
{
    // clientId always comes from the logged-in user (frontend sends user.Client_ID),
    // never hardcoded — each client only ever sees/touches its own PG groups.
    [HttpGet("groups")]
    public async Task<ActionResult<IEnumerable<PgGroup>>> GetGroups([FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<List<PgGroup>>("PgSettings/Group/SelectAll", new
        {
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data ?? []);
    }

    // Insert's "data" on success is just the new row's id (an int), not a full PgGroup —
    // confirmed by calling it directly. Deserializing it as PgGroup throws, so this reads
    // it as int? and re-fetches the group list to hand the frontend real data instead.
    [HttpPost("groups")]
    public async Task<ActionResult<PgGroup>> CreateGroup(PgGroupRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Group/Insert", new
        {
            Client_ID = MasterClient.Id,
            request.GroupName,
            LogoUrl = request.LogoUrl ?? "",
            request.DisplayOrder,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var created = await FindGroupAsync(request.ClientId, result.Data);
        return created is null ? NoContent() : Ok(created);
    }

    // Same as Insert — Update's "data" on success is just an int (e.g. rows affected),
    // not a PgGroup. Re-fetches the group afterward so the frontend gets real data.
    [HttpPut("groups/{id:int}")]
    public async Task<ActionResult<PgGroup>> UpdateGroup(int id, PgGroupRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Group/Update", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
            request.GroupName,
            LogoUrl = request.LogoUrl ?? "",
            request.DisplayOrder,
            request.IsActive,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var updated = await FindGroupAsync(request.ClientId, id);
        return updated is null ? NoContent() : Ok(updated);
    }

    private async Task<PgGroup?> FindGroupAsync(int clientId, int? id)
    {
        if (id is not int groupId) return null;
        var result = await remoteApi.PostAsync<List<PgGroup>>("PgSettings/Group/SelectAll", new { Client_ID = MasterClient.Id });
        return result.Data?.FirstOrDefault(g => g.Id == groupId);
    }

    // Unlike Insert/Update, Delete works correctly upstream — confirmed it returns a
    // proper "PG group not found for this client" business error rather than the
    // parameter-binding bug the other two share.
    [HttpDelete("groups/{id:int}")]
    public async Task<IActionResult> DeleteGroup(int id, [FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<object?>("PgSettings/Group/Delete", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return NoContent();
    }

    // ── Categories ──────────────────────────────────────────────────────────
    // NOTE: PgSettings/Category/* returns a clean 404 upstream as of this writing —
    // confirmed with a verbose request (empty body, Content-Length: 0), not the
    // parameter-binding bug Group/Insert and Group/Update had. That feature just
    // hasn't been deployed on the remote server yet. Everything below is wired up
    // to the same shape Group uses (its closest working sibling) so it should start
    // working the moment the remote endpoints exist — but the exact field names/
    // response shape haven't been confirmed against a real response and may need
    // adjusting once they are.

    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<PgCategory>>> GetCategories([FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<List<PgCategory>>("PgSettings/Category/SelectAll", new
        {
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data ?? []);
    }

    [HttpPost("categories")]
    public async Task<ActionResult<PgCategory>> CreateCategory(PgCategoryRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Category/Insert", new
        {
            Client_ID = MasterClient.Id,
            request.CategoryName,
            request.DisplayOrder,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var created = await FindCategoryAsync(request.ClientId, result.Data);
        return created is null ? NoContent() : Ok(created);
    }

    [HttpPut("categories/{id:int}")]
    public async Task<ActionResult<PgCategory>> UpdateCategory(int id, PgCategoryRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Category/Update", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
            request.CategoryName,
            request.DisplayOrder,
            request.IsActive,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var updated = await FindCategoryAsync(request.ClientId, id);
        return updated is null ? NoContent() : Ok(updated);
    }

    private async Task<PgCategory?> FindCategoryAsync(int clientId, int? id)
    {
        if (id is not int categoryId) return null;
        var result = await remoteApi.PostAsync<List<PgCategory>>("PgSettings/Category/SelectAll", new { Client_ID = MasterClient.Id });
        return result.Data?.FirstOrDefault(c => c.Id == categoryId);
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id, [FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<object?>("PgSettings/Category/Delete", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return NoContent();
    }

    // ── Payment Gateways ────────────────────────────────────────────────────
    // Same Insert/Update "data is just an int, re-fetch afterward" shape as Group/Category.

    [HttpGet("pgs")]
    public async Task<ActionResult<IEnumerable<Pg>>> GetPgs([FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<List<PgRemoteRow>>("PgSettings/Pg/SelectAll", new
        {
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(result.Data?.Select(Pg.FromRemote) ?? []);
    }

    [HttpPost("pgs")]
    public async Task<ActionResult<Pg>> CreatePg(PgRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Pg/Insert", new
        {
            Client_ID = MasterClient.Id,
            request.GroupId,
            request.CategoryId,
            request.PgName,
            Description = request.Description ?? "",
            request.DisplayOrder,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var created = await FindPgAsync(request.ClientId, result.Data);
        return created is null ? NoContent() : Ok(created);
    }

    [HttpPut("pgs/{id:int}")]
    public async Task<ActionResult<Pg>> UpdatePg(int id, PgRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Pg/Update", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
            request.GroupId,
            request.CategoryId,
            request.PgName,
            Description = request.Description ?? "",
            request.DisplayOrder,
            request.IsActive,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        var updated = await FindPgAsync(request.ClientId, id);
        return updated is null ? NoContent() : Ok(updated);
    }

    private async Task<Pg?> FindPgAsync(int clientId, int? id)
    {
        if (id is not int pgId) return null;
        var result = await remoteApi.PostAsync<List<PgRemoteRow>>("PgSettings/Pg/SelectAll", new { Client_ID = MasterClient.Id });
        var row = result.Data?.FirstOrDefault(p => p.PgId == pgId);
        return row is null ? null : Pg.FromRemote(row);
    }

    [HttpDelete("pgs/{id:int}")]
    public async Task<IActionResult> DeletePg(int id, [FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<object?>("PgSettings/Pg/Delete", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return NoContent();
    }

    // ── Settlements ─────────────────────────────────────────────────────────
    // Settlements come back nested inside each Pg from GET /pgs, so there's no separate
    // GET here — after a mutation the frontend just re-fetches the PG list.

    [HttpPost("settlements")]
    public async Task<IActionResult> CreateSettlement(PgSettlementRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Settlement/Insert", new
        {
            Client_ID = MasterClient.Id,
            request.PgId,
            request.SettlementName,
            request.SettlementDays,
            PgKey = request.PgKey ?? "",
            request.PartnerChargeType,
            request.PartnerChargeValue,
            request.PartnerMinCharge,
            request.ChargeType,
            request.ChargeValue,
            request.MinCharge,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return NoContent();
    }

    [HttpPut("settlements/{id:int}")]
    public async Task<IActionResult> UpdateSettlement(int id, PgSettlementRequest request)
    {
        var result = await remoteApi.PostAsync<int?>("PgSettings/Settlement/Update", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
            request.SettlementName,
            request.SettlementDays,
            PgKey = request.PgKey ?? "",
            request.PartnerChargeType,
            request.PartnerChargeValue,
            request.PartnerMinCharge,
            request.ChargeType,
            request.ChargeValue,
            request.MinCharge,
            request.IsActive,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return NoContent();
    }

    [HttpDelete("settlements/{id:int}")]
    public async Task<IActionResult> DeleteSettlement(int id, [FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<object?>("PgSettings/Settlement/Delete", new
        {
            Id = id,
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return NoContent();
    }

    // Pushes the client's current Group/Category/PG/Settlement setup out to every
    // retailer wallet, so edits made here (a new PG, a changed charge, ...) actually
    // reach their Home > Pay In > PG page instead of only applying to wallets whose
    // mapping happens to already include it. "Apply to All" on the Payment Gateway
    // list triggers this.
    [HttpPost("sync-to-retailers")]
    public async Task<IActionResult> SyncToRetailers([FromQuery] int clientId)
    {
        var result = await remoteApi.PostAsync<object?>("PgSettings/WalletMapping/SyncToRetailers", new
        {
            Client_ID = MasterClient.Id,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = result.Message });
    }

    // Same as SyncToRetailers but scoped to one retailer's wallet — "Apply to Individual"
    // on the Payment Gateway list.
    [HttpPost("apply-to-wallet")]
    public async Task<IActionResult> ApplyToWallet([FromQuery] int clientId, [FromQuery] int walletId)
    {
        var result = await remoteApi.PostAsync<object?>("PgSettings/WalletMapping/ApplyToWallet", new
        {
            Client_ID = MasterClient.Id,
            walletId,
        });

        if (!result.IsSuccess)
            return Problem(result.Message, statusCode: StatusCodes.Status502BadGateway);

        return Ok(new { message = result.Message });
    }
}
