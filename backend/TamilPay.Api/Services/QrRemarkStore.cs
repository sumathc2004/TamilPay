using System.Text.Json;

namespace TamilPay.Api.Services;

/// <summary>
/// The note a retailer types when they create a QR collect request. The remote's create-request call does
/// not keep it (it only ever returns an admin's rejection reason in the same field), so it is kept here, in
/// a small file, and matched back to the request by its wallet, QR, UTR and amount. The file lives outside
/// the app folder by default so a redeploy that replaces every file does not erase it.
/// </summary>
public class QrRemarkStore
{
    public record Entry(int WalletId, int QrId, string Utr, decimal Amount, string Remarks, DateTime SavedAt);

    private const int MaxEntries = 20000;
    private readonly object gate = new();
    private readonly List<Entry> entries = [];
    private readonly string path;
    private readonly ILogger<QrRemarkStore> logger;

    public QrRemarkStore(IConfiguration configuration, ILogger<QrRemarkStore> logger)
    {
        this.logger = logger;
        var folder = configuration["Storage:Path"];
        if (string.IsNullOrWhiteSpace(folder))
            folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "TamilPay");
        path = Path.Combine(folder, "qr-remarks.json");

        try
        {
            if (File.Exists(path))
                entries = JsonSerializer.Deserialize<List<Entry>>(File.ReadAllText(path)) ?? [];
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not read {Path}; starting with no saved QR remarks", path);
        }
    }

    public void Add(int walletId, int qrId, string utr, decimal amount, string remarks)
    {
        lock (gate)
        {
            entries.Add(new Entry(walletId, qrId, utr.Trim(), amount, remarks.Trim(), DateTime.Now));
            if (entries.Count > MaxEntries) entries.RemoveRange(0, entries.Count - MaxEntries);
            Save();
        }
    }

    /// <summary>The most recent note saved for a request with this wallet, QR, UTR and amount, if any.</summary>
    public string? Find(int walletId, int qrId, string utr, decimal amount)
    {
        lock (gate)
        {
            return entries.LastOrDefault(e =>
                e.WalletId == walletId && e.QrId == qrId && e.Amount == amount
                && string.Equals(e.Utr, utr.Trim(), StringComparison.OrdinalIgnoreCase))?.Remarks;
        }
    }

    // Written to a temporary file and swapped in, so a crash part-way never leaves a half-written file.
    // A failure here is logged and ignored: the request itself has already been created.
    private void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var temp = path + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(entries));
            File.Move(temp, path, overwrite: true);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not save QR remarks to {Path}", path);
        }
    }
}
