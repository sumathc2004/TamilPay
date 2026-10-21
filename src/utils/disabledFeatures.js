// One switch for the Pay Out services (IMPS, Self Settlement) and bill payments (Card Payments).
// While it is true their Home tiles are greyed out and not clickable, and their pages say they
// are unavailable even if someone types the address. Set it to false to turn them all back on —
// nothing else was removed. Reports of past payments are not affected.
export const PAY_OUT_DISABLED = false;

// The Static QR tile on Home (Pay In). While it is true the tile is greyed out and not clickable.
// Set it to false to turn it back on — the QR screens in Admin and the QR reports are not touched.
export const STATIC_QR_DISABLED = true;

export const DISABLED_PAGES = new Set(PAY_OUT_DISABLED ? ['imps', 'cardPayments'] : []);
