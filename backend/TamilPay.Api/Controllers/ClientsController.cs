using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace TamilPay.Api.Controllers;

/// <summary>
/// Read-only, and only ever the master client.
///
/// The remote exposes Select (every business on the shared server), SelectById
/// for any id, and Insert. None of that belongs in a single-tenant app: listing
/// clients would hand the browser other businesses' names, addresses, GST and
/// PAN, and Insert would create tenants this app has no business creating. So
/// the list returns just client 5, an id that is not 5 is reported as missing,
/// and Insert is not surfaced at all.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ClientsController(RemoteApiClient remoteApi) : ControllerBase
{
    private const string BasePath = "Client";

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Client>>> GetAll()
    {
        var client = await FetchMasterAsync();
        return Ok(client is null ? Array.Empty<Client>() : [client]);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Client>> GetById(int id)
    {
        if (id != MasterClient.Id) return NotFound();

        var client = await FetchMasterAsync();
        return client is null ? NotFound() : Ok(client);
    }

    private async Task<Client?> FetchMasterAsync()
    {
        var result = await remoteApi.PostAsync<List<Client>>($"{BasePath}/SelectById", new { Id = MasterClient.Id });
        return result.Data?.FirstOrDefault();
    }
}
