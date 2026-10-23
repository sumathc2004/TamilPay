import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Network, Percent, Plus, Users } from 'lucide-react';
import { apiUrl } from '../utils/api';
import { MASTER_CLIENT_ID } from '../utils/customer';
import Avatar from '../components/Avatar';
import SearchSelect from '../components/SearchSelect';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';

const rupees = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Customers > a distributor's "View mapping": the retailers mapped to that distributor, their
 * balances and the PG commission on each, and a form to map another retailer. Table on the left and
 * the form beside it on a wide screen; the form first and the rows as cards on a phone.
 */
const DistributorMappingPage = ({ onBack, navParams, user }) => {
  const customerId = navParams?.customerId;
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';

  const [distributor, setDistributor] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const [retailers, setRetailers] = useState(null);
  const [walletId, setWalletId] = useState('');
  const [commission, setCommission] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => fetch(apiUrl(`/api/customers/${customerId}/distributor/retailers`))
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.detail ?? body?.message ?? `Request failed (${res.status})`);
      return body;
    })
    .then((list) => { setRows(list); setError(null); })
    .catch((err) => setError(err.message)), [customerId]);

  useEffect(() => {
    if (!customerId || !isAdmin) return;
    fetch(apiUrl(`/api/customers/${customerId}`)).then((res) => (res.ok ? res.json() : null)).then(setDistributor).catch(() => setDistributor(null));
    load();
    fetch(apiUrl(`/api/customers/retailers?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then(setRetailers)
      .catch((err) => setFormError(err.message));
  }, [customerId, isAdmin, load]);

  // Retailers not mapped to this distributor yet.
  const options = useMemo(() => {
    const mapped = new Set((rows ?? []).map((r) => r.retailerWalletId));
    return (retailers ?? [])
      .filter((r) => (r.roleName || '').toLowerCase() === 'retailer' && !mapped.has(r.walletId))
      .map((r) => ({ value: r.walletId, label: r.fullName, hint: r.storeName }));
  }, [retailers, rows]);

  const save = async (e) => {
    e.preventDefault();
    setFormError('');
    setNotice('');
    const percent = Number(commission);
    if (!walletId) return setFormError('Choose a retailer.');
    if (commission === '' || Number.isNaN(percent) || percent < 0 || percent > 100) return setFormError('Enter a commission between 0 and 100.');

    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/customers/${customerId}/distributor/retailers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerWalletId: Number(walletId), pgCommissionPercent: percent }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(body?.message ?? body?.detail ?? `It didn't go through (${res.status}).`);
        return;
      }
      setWalletId('');
      setCommission('');
      setNotice(body?.message ?? 'Retailer mapped.');
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const total = (rows ?? []).reduce((sum, r) => sum + Number(r.currentBalance ?? 0), 0);
  const average = rows && rows.length > 0
    ? rows.reduce((sum, r) => sum + Number(r.pgCommissionPercent ?? 0), 0) / rows.length
    : null;
  const stats = [
    { label: 'Mapped retailers', value: rows ? rows.length : '…' },
    { label: 'Combined balance', value: rows ? rupees(total) : '…' },
    { label: 'Average commission', value: rows ? (average == null ? '—' : `${Number(average.toFixed(4))}%`) : '…' },
  ];

  if (!isAdmin) {
    return <div className="cu-page"><div className="cu-inner"><p className="cu-state">This page is for admins.</p></div></div>;
  }

  return (
    <div className="cu-page">
      <div className="cu-inner">
        <header className="cu-head">
          <div className="cu-head-text">
            <button type="button" className="cu-back" onClick={() => onBack?.(navParams?.from === 'admin' ? 'admin' : 'customers')} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="cu-title">Mapped retailers</h1>
              <p className="cu-subtitle">Retailers mapped to this distributor, and the PG commission earned on each.</p>
            </div>
          </div>
        </header>

        {/* The distributor and the three figures, in one card */}
        <section className="dm-top">
          <div className="dm-who">
            <Avatar name={distributor?.FULL_NAME ?? '…'} size={52} />
            <div className="dm-who-text">
              <span className="dm-who-name">{distributor?.FULL_NAME ?? 'Loading…'}</span>
              {distributor && <span className="dm-who-sub">+91 {distributor.MOBILE_NUMBER}{distributor.STORE_NAME ? ` · ${distributor.STORE_NAME}` : ''}</span>}
              <span className="cu-role cu-role--admin dm-who-role"><Network size={12} /> Distributor</span>
            </div>
          </div>
          <dl className="dm-stats">
            {stats.map(({ label, value }) => (
              <div key={label} className="dm-stat">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="dm-grid">
          {/* Map another retailer — beside the table on a wide screen, above it on a phone */}
          <aside className="cu-card dm-side">
            <h2 className="dm-card-title"><Plus size={16} /> Map a retailer</h2>
            <form onSubmit={save} className="dm-form">
              <div className="dm-field">
                <label style={labelStyle}>Retailer</label>
                <SearchSelect
                  options={options} value={walletId} onChange={setWalletId} loading={!retailers && !formError}
                  placeholder="Type a retailer name or store" emptyText="No retailer left to map." minWidth={0}
                />
              </div>
              <div className="dm-field">
                <label style={labelStyle}>PG commission (%)</label>
                <div className="dm-percent">
                  <input
                    type="text" inputMode="decimal" className="form-input no-icon" placeholder="e.g. 0.20" value={commission}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); if (/^\d*(\.\d{0,4})?$/.test(v)) setCommission(v); }}
                  />
                  <Percent size={15} className="dm-percent-icon" />
                </div>
              </div>
              {formError && <p role="alert" style={{ ...fieldErrorStyle, margin: 0 }}>{formError}</p>}
              {notice && <p role="status" className="dm-notice">{notice}</p>}
              <button type="submit" className="signin-btn" disabled={saving}>{saving ? 'Mapping…' : 'Map retailer'}</button>
            </form>
          </aside>

          <section className="cu-card dm-list">
            {!rows && !error && <p className="dm-note">Loading…</p>}
            {error && <p className="dm-note dm-note--error">Couldn&apos;t load the mapping: {error}</p>}

            {rows && rows.length === 0 && (
              <div className="dm-empty">
                <span className="dm-empty-icon"><Users size={22} strokeWidth={1.8} /></span>
                <p className="dm-empty-title">No retailers mapped yet</p>
                <p className="dm-empty-text">Use “Map a retailer” to add the first one.</p>
              </div>
            )}

            {rows && rows.length > 0 && (
              <div className="table-scroll cu-scroll">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Retailer</th>
                      <th>Mobile</th>
                      <th className="is-num">Balance</th>
                      <th className="is-num">PG commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.Id ?? r.retailerWalletId}>
                        <td>
                          <div className="cu-person">
                            <Avatar name={r.FULL_NAME} size={36} />
                            <div className="cu-person-text">
                              <span className="cu-person-name">{r.FULL_NAME}</span>
                              {r.STORE_NAME && <span className="cu-person-sub">{r.STORE_NAME}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="cu-nowrap">{r.MOBILE_NUMBER ? `+91 ${r.MOBILE_NUMBER}` : '—'}</td>
                        <td className="is-num"><span className="cu-balance">{rupees(r.currentBalance)}</span></td>
                        <td className="is-num dm-commission">{r.pgCommissionPercent != null ? `${Number(r.pgCommissionPercent)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default DistributorMappingPage;
