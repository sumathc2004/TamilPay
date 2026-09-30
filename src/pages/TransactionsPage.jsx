import React, { useCallback, useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { apiUrl } from '../utils/api';

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

/** IMPS transfer history — today's activity by default (Transaction/Report scoped to
 * today, same call the dashboard would use), with a date range to look further back. */
const TransactionsPage = ({ user }) => {
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = useCallback(() => {
    if (!user?.walletId) return;
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/api/transactions/report?walletId=${user.walletId}&fromDate=${fromDate}&toDate=${toDate}`))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, fromDate, toDate]);

  useEffect(() => {
    fetchRows();
    // Only the initial load — changing dates afterward requires pressing Search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isToday = fromDate === todayIso() && toDate === todayIso();

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(20px, 4vw, 32px)' }}>
        <div style={{ ...cardStyle, maxWidth: 'none', padding: '16px clamp(16px, 3vw, 24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: '#FFF5EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={17} color="#F26A1B" />
              </div>
              <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 19, color: '#0D4FB0', margin: 0 }}>
                Transactions
              </h1>
              {isToday && (
                <span
                  style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.5px', textTransform: 'uppercase', background: '#E0F7EA', color: '#38A169',
                  }}
                >
                  Showing today's data
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '1.2px', color: '#7C8491', marginBottom: 4, textTransform: 'uppercase' }}>
                From
              </label>
              <input
                type="date" className="form-input no-icon" value={fromDate} max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ padding: '8px 12px', fontSize: 13, height: 34 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '1.2px', color: '#7C8491', marginBottom: 4, textTransform: 'uppercase' }}>
                To
              </label>
              <input
                type="date" className="form-input no-icon" value={toDate} min={fromDate} max={todayIso()}
                onChange={(e) => setToDate(e.target.value)}
                style={{ padding: '8px 12px', fontSize: 13, height: 34 }}
              />
            </div>
            <button type="button" onClick={fetchRows} className="signin-btn" style={{ width: 'auto', padding: '0 18px', height: 34, fontSize: 13 }}>
              Search
            </button>
          </div>

          {loading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
          {!loading && error && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load transactions: {error}</p>}
          {!loading && !error && rows.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No transactions in this date range.</p>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                    {['ID', 'Time', 'Account', 'Amount', 'UTR', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase',
                          color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.id}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{new Date(r.createdTime).toLocaleString()}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{r.accountHolderName}</div>
                        <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.accountNumber} · {r.ifsc}</div>
                      </td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap', fontWeight: 700 }}>{money(r.amount)}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.utr || '—'}</td>
                      <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}><StatusBadge status={r.status} /></td>
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

export default TransactionsPage;
