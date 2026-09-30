namespace TamilPay.Api;

/// <summary>
/// TamilPay is single-tenant: every record it reads or writes belongs to this
/// one client on the shared remote API.
///
/// The id is fixed here and never taken from the browser. The remote system
/// hosts other businesses behind the same endpoints, so accepting a client id
/// from the frontend would let a caller read or write another tenant's
/// customers, senders, wallets and payment gateways. Controllers still accept
/// a clientId parameter where the frontend historically sent one, but the
/// value is ignored — this constant is what reaches the remote.
/// </summary>
public static class MasterClient
{
    public const int Id = 5;
}
