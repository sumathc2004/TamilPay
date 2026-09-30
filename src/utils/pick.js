// Reads a field from an object defensively by trying each of several possible key
// casings. The remote Qr/* endpoints in particular have returned empty data every
// single time they've been checked (the QR pool has genuinely never had a row in
// it), so there's never been a real response to confirm exact field names against —
// this tries every plausible casing instead of assuming one and silently dropping
// real data once a row finally shows up.
export const pick = (row, keys) => keys.map((k) => row?.[k]).find((v) => v !== undefined && v !== null);
