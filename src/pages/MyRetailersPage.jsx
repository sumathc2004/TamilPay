import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Users, X } from 'lucide-react';
import { apiUrl } from '../utils/api';
import Avatar from '../components/Avatar';

const rupees = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A distributor's own view of the retailers mapped to them (Distributor/Mapping/SelectRetailers, through
 * their own customer id): who they are, their balance, and the PG commission earned on each. Read-only —
 * mapping a retailer is done by an admin.
 */
const MyRetailersPage = ({ onBack, user }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}/distributor/retailers`))
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.detail ?? body?.message ?? `Request failed (${res.status})`);
        return body;
      })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [user?.id]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => (rows ?? []).filter((r) => !needle
    || [r.FULL_NAME, r.STORE_NAME, r.MOBILE_NUMBER].some((v) => String(v ?? '').toLowerCase().includes(needle))), [rows, needle]);

  const total = (rows ?? []).reduce((sum, r) => sum + Number(r.currentBalance ?? 0), 0);
  const average = rows && rows.length > 0 ? rows.reduce((sum, r) => sum + Number(r.pgCommissionPercent ?? 0), 0) / rows.length : null;
  const stats = [
    { label: 'Mapped retailers', value: rows ? rows.length : '…' },
    { label: 'Combined balance', value: rows ? rupees(total) : '…' },
    { label: 'Average commission', value: rows ? (average == null ? '—' : `${Number(average.toFixed(4))}%`) : '…' },
  ];

  return (
    <div className="cu-page">
      <div className="cu-inner">
        <header className="cu-head">
          <div className="cu-head-text">
            <button type="button" className="cu-back" onClick={() => onBack?.('home')} aria-label="Back">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="cu-title">Retailers</h1>
              <p className="cu-subtitle">The retailers mapped to you, and the PG commission you earn on each.</p>
            </div>
          </div>
        </header>

        <section className="dm-top">
          <div className="dm-who">
            <Avatar name={user?.FULL_NAME ?? ''} size={52} />
            <div className="dm-who-text">
              <span className="dm-who-name">{user?.FULL_NAME}</span>
              <span className="dm-who-sub">{user?.STORE_NAME || user?.storeName || ''}</span>
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

        <section className="cu-card">
          {rows && rows.length > 0 && (
            <div className="mr-toolbar">
              <div className="cu-search">
                <Search size={16} className="cu-search-icon" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, store or mobile" aria-label="Search retailers" />
                {query && (
                  <button type="button" className="cu-search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>
                )}
              </div>
            </div>
          )}

          {!rows && !error && <p className="dm-note">Loading…</p>}
          {error && <p className="dm-note dm-note--error">Couldn&apos;t load your retailers: {error}</p>}

          {rows && rows.length === 0 && (
            <div className="dm-empty">
              <span className="dm-empty-icon"><Users size={22} strokeWidth={1.8} /></span>
              <p className="dm-empty-title">No retailers mapped to you yet</p>
              <p className="dm-empty-text">When an admin maps a retailer to you, they will show up here.</p>
            </div>
          )}

          {rows && rows.length > 0 && visible.length === 0 && <p className="dm-note">No retailer matches “{query.trim()}”.</p>}

          {visible.length > 0 && (
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
                  {visible.map((r) => (
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
  );
};

export default MyRetailersPage;
