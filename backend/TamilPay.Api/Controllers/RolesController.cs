using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace TamilPay.Api.Controllers;

// Read-only — the remote API only exposes Role/Select, nothing to create/update/delete a role.
[ApiController]
[Route("api/[controller]")]
public class RolesController(RemoteApiClient remoteApi) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Role>>> GetAll()
    {
        var result = await remoteApi.PostAsync<List<Role>>("Role/Select");
        return Ok(result.Data ?? []);
    }
}
