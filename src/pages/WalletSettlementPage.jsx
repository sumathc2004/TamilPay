import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Landmark, Wallet as WalletIcon } from 'lucide-react';
import { apiUrl } from '../utils/api';
import DateRangeFields from '../components/DateRangeFields';
import { MASTER_CLIENT_ID } from '../utils/customer';
import PgResultBanner from '../components/PgResultBanner';

const todayIso = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(1,87,111,0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(13, 79, 176, 0.08)',
  padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
};

const money = (v) => `₹${Number(v).toFixed(2)}`;

const StatusBadge = ({ status }) => (
  <span
    style={{
      display: 'inline-block', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
      background: status === 'SUCCESS' ? '#E0F7EA' : status === 'PENDING' ? '#FFF5EB' : '#FFF5F5',
      color: status === 'SUCCESS' ? '#38A169' : status === 'PENDING' ? '#F26A1B' : '#E53E3E',
    }}
  >
    {status}
  </span>
);

/** Wallet balance, settlement bank accounts, and the full debit/credit ledger — the
 * three things "where does the money live and move" covers. Bank accounts come from
 * every customer's linked account on the master client (no dedicated settlement-account
 * concept exists upstream); the ledger reuses the same Wallet/Ledger call the Reports
 * page's Ledger report uses, scoped to the signed-in wallet. */
const WalletSettlementPage = ({ user, walletVersion, onWalletChanged, onNavigate }) => {
  // Arriving from the payment gateway, the redirect carries a token for the payment just
  // made. It is read once and then removed from the address, so a refresh does not repeat it.
  const [paymentToken] = useState(() => new URLSearchParams(window.location.search).get('t') || '');
  useEffect(() => {
    if (paymentToken) window.history.replaceState(null, '', window.location.pathname);
  }, [paymentToken]);

  const [wallet, setWallet] = useState(null);
  const [walletError, setWalletError] = useState(null);

  const [accounts, setAccounts] = useState(null);
  const [accountsError, setAccountsError] = useState(null);

  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [ledgerError, setLedgerError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}/wallet`))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then(setWallet)
      .catch((err) => setWalletError(err.message));
  }, [user, walletVersion]);

  useEffect(() => {
    fetch(apiUrl(`/api/bankaccounts/list?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then(setAccounts)
      .catch((err) => setAccountsError(err.message));
  }, []);

  const fetchLedger = useCallback(() => {
    if (!user?.walletId) return;
    setLedgerLoading(true);
    setLedgerError(null);
    fetch(apiUrl(`/api/transactions/ledger?walletId=${user.walletId}&fromDate=${fromDate}&toDate=${toDate}`))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setLedger)
      .catch((err) => setLedgerError(err.message))
      .finally(() => setLedgerLoading(false));
  }, [user, fromDate, toDate]);

  // Loads when the wallet id is known (it is resolved a moment after sign-in) and again
  // whenever the balance changes, e.g. right after a payment. Changing the dates
  // afterward requires pressing Search.
  useEffect(() => {
    fetchLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.walletId, walletVersion]);

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 19, color: '#0D4FB0', margin: 0 }}>
          Wallet & Settlement
        </h1>

        {paymentToken && <PgResultBanner token={paymentToken} onSuccess={onWalletChanged} onNavigate={onNavigate} />}

        {/* Wallet balance */}
        <div style={{ ...cardStyle, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#E9F2FC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WalletIcon size={22} color="#1565D8" />
          </div>
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700, margin: '0 0 4px' }}>
              Wallet Balance
            </p>
            {walletError && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E', fontSize: 13, margin: 0 }}>Couldn't load: {walletError}</p>}
            {!walletError && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, fontWeight: 800, color: '#0D4FB0', margin: 0 }}>
                {wallet ? money(wallet.currentBalance) : '…'}
              </p>
            )}
          </div>
        </div>

        {/* Settlement bank accounts */}
        <div style={{ ...cardStyle, maxWidth: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: '#EDE3FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Landmark size={17} color="#F26A1B" />
            </div>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: '#0D4FB0', margin: 0 }}>
              Settlement Bank Accounts
            </h2>
          </div>

          {!accounts && !accountsError && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
          {accountsError && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load bank accounts: {accountsError}</p>}
          {accounts && accounts.length === 0 && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No settlement accounts on file.</p>}

          {accounts && accounts.length > 0 && (
            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                    {['Account Holder', 'Account Number', 'IFSC', 'Bank'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                      <td style={{ padding: '6px 12px', color: '#4A5568', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.accountHolderName}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{a.accountNumber}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{a.ifsc}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{a.bankName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ledger */}
        <div style={{ ...cardStyle, maxWidth: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: '#FFF5EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={17} color="#F26A1B" />
              </div>
              <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: '#0D4FB0', margin: 0 }}>
                Wallet Ledger
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <DateRangeFields fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
              <button type="button" onClick={fetchLedger} className="signin-btn" style={{ width: 'auto', padding: '0 18px', height: 34, fontSize: 13 }}>
                Search
              </button>
            </div>
          </div>

          {ledgerLoading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
          {!ledgerLoading && ledgerError && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load ledger: {ledgerError}</p>}
          {!ledgerLoading && !ledgerError && ledger.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No entries in this date range.</p>
          )}

          {!ledgerLoading && !ledgerError && ledger.length > 0 && (
            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                    {['ID', 'Time', 'Type', 'Details', 'Debit', 'Credit', 'Balance', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.id}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{new Date(r.createdTime).toLocaleString()}</td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: r.txnType === 'CREDIT' ? '#38A169' : '#E53E3E' }}>{r.txnType}</span>
                      </td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                        {r.accountHolderName ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{r.accountHolderName}</div>
                            <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.accountNumber} · {r.ifsc}</div>
                          </>
                        ) : (r.remarks || '—')}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.debit > 0 ? money(r.debit) : '—'}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.credit > 0 ? money(r.credit) : '—'}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap', fontWeight: 700 }}>{money(r.balance)}</td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletSettlementPage;
