import React, { useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { usePgStatus } from '../hooks/usePgStatus';
import { LAST_PG_REF_KEY, OUTCOMES, statusRows } from '../utils/pgStatus';

// The names a gateway might use for the reference on its redirect back.
const REF_PARAMS = ['reference_id', 'referenceId', 'referenceNumber', 'ref', 'refNo', 'reference', 'ref_id'];

function initialToken() {
  return new URLSearchParams(window.location.search).get('t')?.trim() || '';
}

function initialReference() {
  // A token from the redirect stands in for the reference; do not fall back to a stale one.
  if (initialToken()) return '';
  const query = new URLSearchParams(window.location.search);
  for (const name of REF_PARAMS) {
    const value = query.get(name);
    if (value) return value.trim();
  }
  try {
    return localStorage.getItem(LAST_PG_REF_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Where a payer lands after the gateway when nobody is signed in on this device. Public,
 * and shows only the outcome, the amount, the UTR and the card. Charges and GST are never
 * requested from the backend, let alone displayed.
 */
const PgStatusPage = () => {
  const [token, setToken] = useState(initialToken);
  const [reference, setReference] = useState(initialReference);
  const [typed, setTyped] = useState(reference);
  const { status, error, loading, refresh } = usePgStatus({ token, reference });

  const submit = (e) => {
    e.preventDefault();
    const next = typed.trim();
    if (!next) return;
    try { localStorage.setItem(LAST_PG_REF_KEY, next); } catch { /* storage unavailable */ }
    // A typed reference replaces the token from the redirect.
    setToken('');
    setReference(next);
  };

  const outcome = status ? OUTCOMES[status.outcome] ?? OUTCOMES.pending : null;
  const rows = statusRows(status);

  return (
    <div className="app-bg pgs-page">
      <header className="app-brandbar">
        <a className="app-brandbar-logo" href="/" aria-label="TamilPay home">
          <BrandLogo height="clamp(44px, 6vw, 70px)" />
        </a>
      </header>

      <main className="pgs-main">
        <section className={`pgs-card${outcome ? ` pgs-card--${outcome.tone}` : ''}`}>
          {outcome ? (
            <>
              <span className="pgs-icon"><outcome.Icon size={40} strokeWidth={2} /></span>
              <h1 className="pgs-title">{outcome.title}</h1>
              <p className="pgs-message">{status.message}</p>

              {rows.length > 0 && (
                <dl className="pgs-rows">
                  {rows.map(([label, value]) => (
                    <div key={label} className="pgs-row">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {status.outcome === 'pending' && (
                <button type="button" className="pgs-refresh" onClick={refresh} disabled={loading}>
                  <RefreshCw size={15} className={loading ? 'pgs-spin' : ''} /> Check again
                </button>
              )}
            </>
          ) : (
            <>
              <span className="pgs-icon"><Clock size={40} strokeWidth={2} /></span>
              <h1 className="pgs-title">{loading ? 'Checking payment…' : 'Check payment status'}</h1>
              {error
                ? <p className="pgs-message pgs-message--error">{error}</p>
                : <p className="pgs-message">{loading ? 'One moment.' : 'Enter the reference number of your payment.'}</p>}
            </>
          )}

          {!loading && (!status || error) && (
            <form className="pgs-form" onSubmit={submit}>
              <input
                className="form-input no-icon"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Reference number"
                aria-label="Reference number"
              />
              <button type="submit" className="signin-btn" style={{ height: 44 }}>Check status</button>
            </form>
          )}

          <a className="pgs-back" href="/wallet-settlement">Go to wallet ledger</a>
        </section>
      </main>
    </div>
  );
};

export default PgStatusPage;
