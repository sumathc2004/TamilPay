import { CheckCircle2, Clock, XCircle } from 'lucide-react';

// Where the reference number last generated in this browser is kept, so the status page
// can still look the payment up if the gateway sends the payer back without a token.
export const LAST_PG_REF_KEY = 'tamilpay_last_pg_ref';

export const OUTCOMES = {
  success: { Icon: CheckCircle2, title: 'Payment successful', tone: 'ok' },
  failed: { Icon: XCircle, title: 'Payment failed', tone: 'bad' },
  pending: { Icon: Clock, title: 'Payment pending', tone: 'wait' },
};

/** The labelled values a result shows — amount, UTR, card. Never charges or GST.
 *  `withBalance` adds the wallet balance after the credit: only for the signed-in owner of
 *  that wallet, never for the public status page a payer sees. */
export function statusRows(status, { withBalance = false } = {}) {
  if (!status) return [];
  const amount = status.amount != null ? `₹${Number(status.amount).toFixed(2)}` : null;
  return [
    [status.outcome === 'success' ? 'Amount debited' : 'Amount', amount],
    ['UTR', status.utr],
    ['Card', status.cardNumber ? `•••• ${status.cardNumber}` : null],
    ['Balance after credit', withBalance && status.closingBalance != null ? `₹${Number(status.closingBalance).toFixed(2)}` : null],
    ['Reference', status.referenceId],
  ].filter(([, value]) => value);
}

// The gateway is opened in a new tab, and a new tab does not inherit a sign-in that lives
// in sessionStorage — so coming back from it would find nobody signed in. When a payment
// link is created the session is stashed here for a short while, and is taken back (once)
// only by a page load that carries the payment token the redirect adds.
const PAY_RETURN_KEY = 'tamilpay_pay_return';
const PAY_RETURN_TTL_MS = 30 * 60 * 1000;

export function stashPaymentReturnSession(user) {
  if (!user) return;
  try {
    localStorage.setItem(PAY_RETURN_KEY, JSON.stringify({ user, expires: Date.now() + PAY_RETURN_TTL_MS }));
  } catch {
    // Storage unavailable — the return simply shows the payment result instead.
  }
}

/** The stashed user, if it is still fresh; removed either way so it can only be used once. */
export function takePaymentReturnSession() {
  try {
    const raw = localStorage.getItem(PAY_RETURN_KEY);
    localStorage.removeItem(PAY_RETURN_KEY);
    const stash = raw ? JSON.parse(raw) : null;
    return stash && stash.expires > Date.now() ? stash.user : null;
  } catch {
    return null;
  }
}
