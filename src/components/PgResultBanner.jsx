import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { usePgStatus } from '../hooks/usePgStatus';
import { OUTCOMES, statusRows } from '../utils/pgStatus';

/**
 * The result of the payment a payer has just come back from, shown at the top of the page
 * they land on. `onSuccess` fires once when the payment is confirmed, so the page can
 * reload the balance and ledger it is sitting on.
 */
const PgResultBanner = ({ token, onSuccess }) => {
  const { status, error, loading } = usePgStatus({ token });
  const [dismissed, setDismissed] = useState(false);
  const notified = useRef(false);

  useEffect(() => {
    if (status?.outcome === 'success' && !notified.current) {
      notified.current = true;
      onSuccess?.();
    }
  }, [status, onSuccess]);

  if (dismissed || (!status && !error && !loading)) return null;

  const outcome = status ? OUTCOMES[status.outcome] ?? OUTCOMES.pending : null;
  const rows = statusRows(status, { withBalance: true });

  return (
    <section className={`pgr-banner${outcome ? ` pgr-banner--${outcome.tone}` : ''}`} role="status">
      <span className="pgr-icon">{outcome ? <outcome.Icon size={26} strokeWidth={2} /> : null}</span>
      <div className="pgr-body">
        <p className="pgr-title">{outcome ? outcome.title : loading ? 'Checking your payment…' : 'Payment status'}</p>
        <p className="pgr-message">{error ?? (status ? status.message : 'One moment.')}</p>
        {rows.length > 0 && (
          <dl className="pgr-rows">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <button type="button" className="pgr-close" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <X size={16} />
      </button>
    </section>
  );
};

export default PgResultBanner;
