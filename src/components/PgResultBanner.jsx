import React, { useEffect, useRef, useState } from 'react';
import { CreditCard, Landmark, Wallet, X } from 'lucide-react';
import Modal from './Modal';
import { usePgStatus } from '../hooks/usePgStatus';
import { OUTCOMES, statusRows } from '../utils/pgStatus';

// How long the payer has to pick where to go before the page takes them back to PG.
const REDIRECT_SECONDS = 10;

const DESTINATIONS = [
  { page: 'pg', label: 'PG', Icon: CreditCard },
  { page: 'walletSettlement', label: 'Wallet ledger', Icon: Wallet },
  { page: 'cardPayments', label: 'Card Payments', Icon: Landmark },
];

/**
 * The result of the payment a payer has just come back from, shown as a popup over the page
 * they land on, with where to go next. Once the result is final (paid or failed) a
 * 10-second countdown starts and then takes them back to PG; "Stay here" or closing the popup
 * stops it. `onSuccess` fires once when the payment is confirmed, so the page can reload the
 * balance and ledger it is sitting on.
 */
const PgResultBanner = ({ token, onSuccess, onNavigate }) => {
  const { status, error, loading } = usePgStatus({ token });
  const [dismissed, setDismissed] = useState(false);
  const [counting, setCounting] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const notified = useRef(false);

  const final = status?.outcome === 'success' || status?.outcome === 'failed';

  useEffect(() => {
    if (status?.outcome === 'success' && !notified.current) {
      notified.current = true;
      onSuccess?.();
    }
  }, [status, onSuccess]);

  // Starts only once the result is final, so a payment still being processed is never
  // navigated away from.
  useEffect(() => {
    if (!final || !counting || dismissed) return undefined;
    if (secondsLeft <= 0) {
      onNavigate?.('pg');
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [final, counting, dismissed, secondsLeft, onNavigate]);

  if (dismissed || (!status && !error && !loading)) return null;

  const outcome = status ? OUTCOMES[status.outcome] ?? OUTCOMES.pending : null;
  const rows = statusRows(status, { withBalance: true });
  const close = () => { setCounting(false); setDismissed(true); };
  const go = (page) => {
    setCounting(false);
    if (page === 'walletSettlement') setDismissed(true); // already on the ledger
    else onNavigate?.(page);
  };

  return (
    <Modal onClose={close} style={{ width: 440, maxWidth: '92vw', padding: 0 }}>
      <section className={`pgr-popup${outcome ? ` pgr-banner--${outcome.tone}` : ''}`} role="status">
        <button type="button" className="pgr-close pgr-popup-close" onClick={close} aria-label="Close">
          <X size={16} />
        </button>
        <span className="pgr-icon pgr-popup-icon">{outcome ? <outcome.Icon size={34} strokeWidth={2} /> : null}</span>
        <p className="pgr-title pgr-popup-title">{outcome ? outcome.title : loading ? 'Checking your payment…' : 'Payment status'}</p>
        <p className="pgr-message pgr-popup-message">{error ?? (status ? status.message : 'One moment.')}</p>

        {rows.length > 0 && (
          <dl className="pgr-popup-rows">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="pgr-popup-next">Where to next?</p>
        <div className="pgr-popup-actions">
          {DESTINATIONS.map(({ page, label, Icon }) => (
            <button key={page} type="button" className="pgr-popup-go" onClick={() => go(page)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>

        {final && counting && (
          <p className="pgr-popup-count">
            Taking you to PG in <strong>{secondsLeft}</strong>s ·{' '}
            <button type="button" className="pgr-popup-stay" onClick={() => setCounting(false)}>Stay here</button>
          </p>
        )}
      </section>
    </Modal>
  );
};

export default PgResultBanner;
