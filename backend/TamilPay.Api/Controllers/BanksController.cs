using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace TamilPay.Api.Controllers;

// Read-only master list of banks — used to populate the Bank Name dropdown when registering a bank account.
[ApiController]
[Route("api/[controller]")]
public class BanksController(RemoteApiClient remoteApi) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Bank>>> GetAll()
    {
        var result = await remoteApi.PostAsync<List<Bank>>("Bank/Select");
        return Ok(result.Data ?? []);
    }
}
