using TamilPay.Api.Models;
using TamilPay.Api.Services;
using Microsoft.AspNetCore.Mvc;

using TamilPay.Api;

namespace TamilPay.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SendersController(RemoteApiClient remoteApi) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Sender>> Search([FromQuery] int clientId, [FromQuery] string mobileNumber)
    {
        var result = await remoteApi.PostAsync<List<Sender>>("sender/SelectByMobileAndClientId", new
        {
            Client_ID = MasterClient.Id,
            mobileNumber,
        });

        if (!result.IsSuccess || result.Data?.FirstOrDefault() is not { } sender)
            return NotFound();

        return Ok(sender);
    }

    [HttpPost]
    public async Task<ActionResult<Sender>> Create(SenderRequest request)
    {
        var insertResult = await remoteApi.PostAsync<int?>("sender/Insert", request.ToSender());
        if (!insertResult.IsSuccess)
            return Problem(insertResult.Message, statusCode: StatusCodes.Status502BadGateway);

        return await Search(request.ClientId, request.MobileNumber);
    }
}
