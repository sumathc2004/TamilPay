import React, { useEffect, useState } from 'react';
import { Plus, QrCode, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import { apiUrl } from '../utils/api';
import { MASTER_CLIENT_ID } from '../utils/customer';
import { pick } from '../utils/pick';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.08)',
  padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
};

const CHARGE_TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Percentage' },
  { value: 'VALUE', label: 'Value' },
];

const EMPTY_FORM = { qrName: '', vpa: '', chargeType: 'PERCENT', chargeValue: '', minCharge: '', dailyMaxLimit: '', displayOrder: '' };

const formatCharge = (type, value) => (type === 'PERCENT' ? `${value}%` : `₹${Number(value).toFixed(2)}`);

/**
 * Admin > QR — every QR code on file for the client (Qr/SelectAll), plus Add New
 * (Qr/Insert). Row shape isn't confirmed: the pool has been empty for this client
 * every single time any Qr/* endpoint was checked while building this and the other
 * QR features, so field names are read defensively (see utils/pick.js) rather than
 * assumed — the columns below mirror what Qr/Insert accepts, since a freshly
 * inserted row almost certainly carries those same fields back out.
 */
const QrCodesPage = () => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAll = () => {
    setLoading(true);
    setError(null);
    fetch(apiUrl(`/api/qr/all?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowAdd(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.qrName.trim() || !form.vpa.trim() || !form.chargeValue || !form.minCharge || !form.dailyMaxLimit || !form.displayOrder) {
      setFormError('Fill in all fields.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(apiUrl('/api/qr/insert'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrName: form.qrName.trim(),
          vpa: form.vpa.trim(),
          chargeType: form.chargeType,
          chargeValue: Number(form.chargeValue),
          minCharge: Number(form.minCharge),
          dailyMaxLimit: Number(form.dailyMaxLimit),
          displayOrder: Number(form.displayOrder),
        }),
      });

      if (res.ok) {
        setShowAdd(false);
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        setFormError(problem?.detail ?? problem?.message ?? `Failed to add QR code (${res.status}).`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="theme-purple" style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(20px, 4vw, 32px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--theme-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={17} color="var(--theme-accent)" />
            </div>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 19, color: 'var(--theme-heading)', margin: 0 }}>
              QR Codes
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="icon-btn-anim"
              onClick={loadAll}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff',
                border: '1.5px solid var(--theme-heading)', borderRadius: 10, color: 'var(--theme-heading)',
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, padding: '9px 16px',
                cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
              }}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={openAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'var(--theme-accent)', border: 'none',
                borderRadius: 10, color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                fontSize: 13, padding: '9px 16px', cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Add New
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, maxWidth: 'none' }}>
          {loading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
          {!loading && error && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load QR codes: {error}</p>
          )}
          {!loading && !error && rows?.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No QR codes on file for this client yet.</p>
          )}

          {!loading && !error && rows?.length > 0 && (
            <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                    {['ID', 'Name', 'VPA', 'Charge', 'Min Charge', 'Daily Limit', 'Order', 'Status'].map((h) => (
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
                  {rows.map((r, i) => {
                    const id = pick(r, ['id', 'Id', 'QrId', 'qrId']);
                    const name = pick(r, ['qrName', 'QrName']);
                    const vpa = pick(r, ['vpa', 'Vpa', 'VPA']);
                    const chargeType = pick(r, ['chargeType', 'ChargeType']);
                    const chargeValue = pick(r, ['chargeValue', 'ChargeValue']);
                    const minCharge = pick(r, ['minCharge', 'MinCharge']);
                    const dailyMaxLimit = pick(r, ['dailyMaxLimit', 'DailyMaxLimit']);
                    const displayOrder = pick(r, ['displayOrder', 'DisplayOrder']);
                    const status = pick(r, ['status', 'Status', 'isActive', 'IsActive']);
                    return (
                      <tr key={id ?? i} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{id ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', fontWeight: 600, whiteSpace: 'nowrap' }}>{name ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{vpa ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                          {chargeType && chargeValue != null ? formatCharge(chargeType, chargeValue) : '—'}
                        </td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{minCharge != null ? `₹${Number(minCharge).toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{dailyMaxLimit != null ? `₹${Number(dailyMaxLimit).toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{displayOrder ?? '—'}</td>
                        <td style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>{status === undefined ? '—' : String(status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <Modal onClose={() => !submitting && setShowAdd(false)} themeClassName="theme-purple" style={{ padding: 'clamp(20px, 5vw, 28px)', width: 420, maxWidth: '90vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--theme-heading)', margin: '0 0 16px' }}>
            Add QR Code
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Name</label>
              <input
                className="form-input no-icon" placeholder="e.g. QR 1"
                value={form.qrName}
                onChange={(e) => setForm((f) => ({ ...f, qrName: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>VPA</label>
              <input
                className="form-input no-icon" placeholder="e.g. shop@ybl"
                value={form.vpa}
                onChange={(e) => setForm((f) => ({ ...f, vpa: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Charge Type</label>
                <select
                  className="form-input no-icon"
                  value={form.chargeType}
                  onChange={(e) => setForm((f) => ({ ...f, chargeType: e.target.value }))}
                >
                  {CHARGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>Charge Value</label>
                <input
                  type="text" inputMode="decimal" className="form-input no-icon" placeholder="e.g. 1.5"
                  value={form.chargeValue}
                  onChange={(e) => setForm((f) => ({ ...f, chargeValue: e.target.value.replace(/[^0-9.]/g, '') }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Min Charge</label>
                <input
                  type="text" inputMode="decimal" className="form-input no-icon" placeholder="e.g. 5"
                  value={form.minCharge}
                  onChange={(e) => setForm((f) => ({ ...f, minCharge: e.target.value.replace(/[^0-9.]/g, '') }))}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>Daily Max Limit</label>
                <input
                  type="text" inputMode="decimal" className="form-input no-icon" placeholder="e.g. 50000"
                  value={form.dailyMaxLimit}
                  onChange={(e) => setForm((f) => ({ ...f, dailyMaxLimit: e.target.value.replace(/[^0-9.]/g, '') }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Display Order</label>
              <input
                type="text" inputMode="numeric" className="form-input no-icon" placeholder="e.g. 1"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value.replace(/[^0-9]/g, '') }))}
              />
            </div>

            {formError && <p style={fieldErrorStyle}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowAdd(false)}
                disabled={submitting}
                style={{
                  flex: 1, background: 'none', border: '1px solid rgba(var(--theme-heading-rgb),0.15)', borderRadius: 12,
                  padding: '12px 0', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
                style={{
                  flex: 1, background: 'var(--theme-accent)', border: 'none', borderRadius: 12,
                  padding: '12px 0', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
                  color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default QrCodesPage;
