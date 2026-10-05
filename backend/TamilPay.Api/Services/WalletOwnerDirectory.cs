using Microsoft.Extensions.Caching.Memory;
using TamilPay.Api.Models;

namespace TamilPay.Api.Services;

/// <summary>Who a wallet belongs to: the retailer's name and mobile, and their shop.</summary>
public record WalletOwner(string Name, string Mobile, string Store);

/// <summary>
/// Wallet -> retailer lookup. Several remote reports (IMPS, QR requests) name only a walletId,
/// not who it belongs to, and none returns the shop name. The answer is built the way the
/// retailers list is — every customer on the client, then each one's wallet — which costs one
/// remote call per customer, so it is kept for a few minutes. Only the master client's
/// customers are ever read.
/// </summary>
public class WalletOwnerDirectory(RemoteApiClient remoteApi, IMemoryCache cache)
{
    private const string CacheKey = "wallet-owners:v2";

    public async Task<Dictionary<int, WalletOwner>> GetAsync()
    {
        if (cache.TryGetValue<Dictionary<int, WalletOwner>>(CacheKey, out var cached) && cached is not null)
            return cached;

        var customers = await remoteApi.PostAsync<List<Customer>>("customer/SelectByClientId", new { Client_ID = MasterClient.Id });
        var lookups = (customers.Data ?? []).Where(c => c.Username is not null).Select(async c =>
        {
            var wallet = (await remoteApi.PostAsync<List<Wallet>>("wallet/SelectByCustomerId", new
            {
                Client_ID = MasterClient.Id,
                CustomerId = c.Id,
            })).Data?.FirstOrDefault();
            return (WalletId: wallet?.WalletId, Name: string.IsNullOrWhiteSpace(c.FullName) ? c.StoreName : c.FullName, c.MobileNumber, c.StoreName);
        });

        var owners = (await Task.WhenAll(lookups))
            .Where(o => o.WalletId is not null && !string.IsNullOrWhiteSpace(o.Name))
            .GroupBy(o => o.WalletId!.Value)
            .ToDictionary(g => g.Key, g => new WalletOwner(g.First().Name!, g.First().MobileNumber ?? string.Empty, g.First().StoreName ?? string.Empty));

        // Not cached when empty — that would be a failed lookup, not "no retailers".
        if (owners.Count > 0) cache.Set(CacheKey, owners, TimeSpan.FromMinutes(10));
        return owners;
    }
}
