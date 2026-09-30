using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController(RemoteApiClient remoteApi) : ControllerBase
{
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
}
