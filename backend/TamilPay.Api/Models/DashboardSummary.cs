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

/// <summary>"data" of the remote Dashboard/Explain API — the same wallet/pipe totals as the
/// dashboard, plus what moved today, to explain why the two do not match.</summary>
public class DashboardExplain
{
    public int WalletCount { get; set; }
    public decimal WalletBalance { get; set; }
    public decimal PipeBalance { get; set; }
    public decimal Difference { get; set; }
    public ExplainToday Today { get; set; } = new();
}

/// <summary>Today's movements. Amounts only; "Failed" payments come back as "Refund" credits.</summary>
public class ExplainToday
{
    public decimal PgCredit { get; set; }
    public decimal ImpsSuccess { get; set; }
    public decimal ImpsFailed { get; set; }
    public decimal ImpsRefund { get; set; }
    public decimal ImpsPending { get; set; }
    public decimal BbpsSuccess { get; set; }
    public decimal BbpsFailed { get; set; }
    public decimal BbpsRefund { get; set; }
    public decimal VerifyDebit { get; set; }
}
