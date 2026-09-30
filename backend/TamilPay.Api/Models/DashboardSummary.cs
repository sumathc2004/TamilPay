namespace TamilPay.Api.Models;

/// <summary>Shape returned by the remote Dashboard/Get API — an admin-only financial summary.</summary>
public class DashboardSummary
{
    public List<PipeBalance> PipeBalances { get; set; } = [];
    public decimal TotalPipeBalance { get; set; }
    public decimal TotalWalletBalance { get; set; }
    public int WalletCount { get; set; }
    public decimal Difference { get; set; }
}

public class PipeBalance
{
    public string PipeName { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
