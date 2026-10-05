import React, { useEffect, useState } from 'react';
import { Check, ClipboardList, RefreshCw, X } from 'lucide-react';
import Modal from '../components/Modal';
import { apiUrl } from '../utils/api';
import { pick } from '../utils/pick';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.08)',
  padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
};

const money = (v) => `₹${Number(v).toFixed(2)}`;

const StatusBadge = ({ status }) => (
  <span
    style={{
      display: 'inline-block', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
      background: status === 'SUCCESS' || status === 'APPROVED' ? '#E0F7EA' : status === 'PENDING' ? '#FFF5EB' : '#FFF5F5',
      color: status === 'SUCCESS' || status === 'APPROVED' ? '#38A169' : status === 'PENDING' ? '#F26A1B' : '#E53E3E',
    }}
  >
    {status || '—'}
  </span>
);

// A QR request row's field casing isn't confirmed — no collect request has ever
// actually gone through yet (the QR pool was empty every time this was checked),
// so there's no real row to shape a model against. Read defensively (utils/pick.js).
const readRow = (r) => ({
  id: pick(r, ['id', 'Id']),
  createdTime: pick(r, ['createdTime', 'CreatedTime']),
  vpa: pick(r, ['vpa', 'Vpa', 'VPA']),
  amount: pick(r, ['amount', 'Amount']),
  utr: pick(r, ['utr', 'Utr', 'UTR']),
  status: pick(r, ['status', 'Status']),
  // Who is asking: the retailer, their mobile and their shop (storeName is added by our
  // backend — the remote names the retailer but not the shop).
  retailerName: pick(r, ['retailerName', 'RetailerName']),
  mobile: pick(r, ['username', 'Username']),
  storeName: pick(r, ['storeName', 'StoreName']),
  qrName: pick(r, ['QrName', 'qrName']),
  creditAmount: pick(r, ['creditAmount', 'CreditAmount']),
  remarks: pick(r, ['remarks', 'Remarks']),
});

// A second, muted line under a table value.
const Sub = ({ children }) => (
  <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: '#8A93A4', whiteSpace: 'normal' }}>{children}</div>
);

/**
 * Admin > QR Requests — pending collect requests awaiting approval (with Approve/
 * Reject actions), plus the full client-wide history below it. Separate from the
 * QR Codes page (which manages the QR inventory itself, not requests against it).
 */
const QrRequestsPage = () => {
  const [pending, setPending] = useState(null);
  const [pendingError, setPendingError] = useState(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);

  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectError, setRejectError] = useState(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const loadPending = () => {
    setPendingLoading(true);
    setPendingError(null);
    fetch(apiUrl('/api/qr/pending'))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setPending)
      .catch((err) => setPendingError(err.message))
      .finally(() => setPendingLoading(false));
  };

  const loadReport = () => {
    setReportLoading(true);
    setReportError(null);
    fetch(apiUrl('/api/qr/admin-report'))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setReport)
      .catch((err) => setReportError(err.message))
      .finally(() => setReportLoading(false));
  };

  const loadAll = () => {
    loadPending();
    loadReport();
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this QR request?')) return;
    setActioningId(id);
    try {
      const res = await fetch(apiUrl('/api/qr/approve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        window.alert(problem?.detail ?? problem?.message ?? `Failed to approve (${res.status}).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const openReject = (id) => {
    setRejectTarget(id);
    setRejectRemarks('');
    setRejectError(null);
  };

  const submitReject = async (e) => {
    e.preventDefault();
    if (!rejectRemarks.trim()) {
      setRejectError('Enter a reason for rejecting this request.');
      return;
    }
    setRejectSubmitting(true);
    setRejectError(null);
    try {
      const res = await fetch(apiUrl('/api/qr/reject'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectTarget, remarks: rejectRemarks.trim() }),
      });
      if (res.ok) {
        setRejectTarget(null);
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        setRejectError(problem?.detail ?? problem?.message ?? `Failed to reject (${res.status}).`);
      }
    } catch (err) {
      setRejectError(err.message);
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <div className="theme-purple" style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(20px, 4vw, 32px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--theme-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={17} color="var(--theme-accent)" />
            </div>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 19, color: 'var(--theme-heading)', margin: 0 }}>
              QR Requests
            </h1>
          </div>
          <button
            type="button"
            className="icon-btn-anim"
            onClick={loadAll}
            disabled={pendingLoading || reportLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff',
              border: '1.5px solid var(--theme-heading)', borderRadius: 10, color: 'var(--theme-heading)',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, padding: '9px 16px',
              cursor: (pendingLoading || reportLoading) ? 'default' : 'pointer', opacity: (pendingLoading || reportLoading) ? 0.6 : 1,
            }}
          >
            <RefreshCw size={15} className={(pendingLoading || reportLoading) ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {/* Pending approval */}
        <div style={{ ...cardStyle, maxWidth: 'none' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--theme-heading)', margin: '0 0 16px' }}>
            Pending Approval
          </h2>

          {pendingLoading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
          {!pendingLoading && pendingError && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load pending requests: {pendingError}</p>
          )}
          {!pendingLoading && !pendingError && pending?.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Nothing waiting on approval.</p>
          )}

          {!pendingLoading && !pendingError && pending?.length > 0 && (
            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                    {['ID', 'Time', 'Retailer', 'Shop', 'VPA', 'Amount', 'UTR', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((raw, i) => {
                    const r = readRow(raw);
                    const busy = actioningId === r.id;
                    return (
                      <tr key={r.id ?? i} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.id ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.createdTime ? new Date(r.createdTime).toLocaleString() : '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#12284A' }}>{r.retailerName ?? '—'}</div>
                          {r.mobile && <Sub>{r.mobile}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', fontWeight: 600 }}>{r.storeName || '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          {r.vpa ?? '—'}
                          {r.qrName && <Sub>{r.qrName}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {r.amount != null ? money(r.amount) : '—'}
                          {r.creditAmount != null && <Sub>Credit {money(r.creditAmount)}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          {r.utr ?? '—'}
                          {r.remarks && <Sub>{r.status === 'REJECTED' ? `Rejected: ${r.remarks}` : r.remarks}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleApprove(r.id)}
                              disabled={busy || r.id == null}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4, background: '#E0F7EA', border: 'none',
                                borderRadius: 7, color: '#38A169', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                                fontSize: 11.5, padding: '6px 10px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                              }}
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => openReject(r.id)}
                              disabled={busy || r.id == null}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4, background: '#FFF5F5', border: 'none',
                                borderRadius: 7, color: '#E53E3E', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                                fontSize: 11.5, padding: '6px 10px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                              }}
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Full history */}
        <div style={{ ...cardStyle, maxWidth: 'none' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--theme-heading)', margin: '0 0 16px' }}>
            All Requests
          </h2>

          {reportLoading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
          {!reportLoading && reportError && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load requests: {reportError}</p>
          )}
          {!reportLoading && !reportError && report?.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No QR requests yet.</p>
          )}

          {!reportLoading && !reportError && report?.length > 0 && (
            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                    {['ID', 'Time', 'Retailer', 'Shop', 'VPA', 'Amount', 'UTR', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.map((raw, i) => {
                    const r = readRow(raw);
                    return (
                      <tr key={r.id ?? i} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.id ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{r.createdTime ? new Date(r.createdTime).toLocaleString() : '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#12284A' }}>{r.retailerName ?? '—'}</div>
                          {r.mobile && <Sub>{r.mobile}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', fontWeight: 600 }}>{r.storeName || '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          {r.vpa ?? '—'}
                          {r.qrName && <Sub>{r.qrName}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {r.amount != null ? money(r.amount) : '—'}
                          {r.creditAmount != null && <Sub>Credit {money(r.creditAmount)}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          {r.utr ?? '—'}
                          {r.remarks && <Sub>{r.status === 'REJECTED' ? `Rejected: ${r.remarks}` : r.remarks}</Sub>}
                        </td>
                        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}><StatusBadge status={r.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {rejectTarget != null && (
        <Modal onClose={() => !rejectSubmitting && setRejectTarget(null)} themeClassName="theme-purple" style={{ padding: 'clamp(20px, 5vw, 28px)', width: 380, maxWidth: '90vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--theme-heading)', margin: '0 0 16px' }}>
            Reject QR Request #{rejectTarget}
          </h2>
          <form onSubmit={submitReject}>
            <label style={labelStyle}>Reason</label>
            <input
              className="form-input no-icon" placeholder="e.g. UTR not found" autoFocus
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            {rejectError && <p style={fieldErrorStyle}>{rejectError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRejectTarget(null)}
                disabled={rejectSubmitting}
                style={{
                  flex: 1, background: 'none', border: '1px solid rgba(var(--theme-heading-rgb),0.15)', borderRadius: 12,
                  padding: '12px 0', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejectSubmitting}
                style={{
                  flex: 1, background: '#E53E3E', border: 'none', borderRadius: 12,
                  padding: '12px 0', cursor: rejectSubmitting ? 'default' : 'pointer', opacity: rejectSubmitting ? 0.7 : 1,
                  color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}
              >
                {rejectSubmitting ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default QrRequestsPage;
