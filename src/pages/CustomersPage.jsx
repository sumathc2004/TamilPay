import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, BookOpen, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Eye, FileChartColumn, Pencil, Plus, QrCode, Receipt, Search, Trash2, Users, Wallet, WalletCards, X } from 'lucide-react';
import { fieldErrorStyle, iconBtnStyle } from '../styles/formStyles';
import { getCustomerId, MASTER_CLIENT_ID } from '../utils/customer';
import { apiUrl } from '../utils/api';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';

/**
 * CustomersPage — same visual language as HomePage (background swoosh)
 * with a live list of customers from the remote Client/Customer API.
 * Adding, viewing, and editing all happen on their own full page
 * (CustomerDetailPage) — this page is just the list and quick delete.
 */
// The reports that belong to one wallet — the ones a row's Reports menu can open for that
// customer (the client-wide admin reports aren't about any single customer).
const CUSTOMER_REPORTS = [
  { key: 'transfer', label: 'Transfer Reports', Icon: Receipt },
  { key: 'pgReports', label: 'PG Reports', Icon: CreditCard },
  { key: 'cardReports', label: 'Credit Card Reports', Icon: WalletCards },
  { key: 'ledger', label: 'Wallet Ledger', Icon: BookOpen },
  { key: 'qrReports', label: 'QR Reports', Icon: QrCode },
];
const REPORT_MENU_WIDTH = 224;
const PAGE_SIZE = 15;

// ₹2,515.32 — Indian digit grouping, two decimals.
const rupees = (value) => `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const REPORT_MENU_HEIGHT = CUSTOMER_REPORTS.length * 44 + 16;

const CustomersPage = ({ onNavigate, user, onWalletChanged }) => {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Row Reports dropdown: fixed-position (the table's scroll box would clip an absolute one),
  // placed from the button's rectangle and flipped upward near the bottom of the screen.
  const [reportMenu, setReportMenu] = useState(null); // { customer, left, top }
  const openReportMenu = (e, customer) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fitsBelow = rect.bottom + 6 + REPORT_MENU_HEIGHT < window.innerHeight;
    setReportMenu({
      customer,
      left: Math.max(8, Math.min(rect.right - REPORT_MENU_WIDTH, window.innerWidth - REPORT_MENU_WIDTH - 8)),
      top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - REPORT_MENU_HEIGHT),
    });
  };
  useEffect(() => {
    if (!reportMenu) return undefined;
    const close = () => setReportMenu(null);
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [reportMenu]);

  const [walletBusyId, setWalletBusyId] = useState(null);
  const [walletError, setWalletError] = useState(null);

  // customerId -> payoutCharges / live balance / walletId, fetched separately since
  // they live on the wallet, not the customer record (and the customer record's own
  // lastBalance is only a snapshot from whenever that row was first loaded).
  const [payoutCharges, setPayoutCharges] = useState({});
  const [walletBalances, setWalletBalances] = useState({});
  const [walletIds, setWalletIds] = useState({});
  const [editingPayoutId, setEditingPayoutId] = useState(null);
  const [payoutInput, setPayoutInput] = useState('');
  const [payoutBusyId, setPayoutBusyId] = useState(null);
  const [payoutError, setPayoutError] = useState(null);

  const [transferTarget, setTransferTarget] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferReceipt, setTransferReceipt] = useState(null);

  useEffect(() => {
    fetch(apiUrl(`/api/customers?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setCustomers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshWallets = () => {
    const withWallets = customers.filter((c) => c.username);
    if (withWallets.length === 0) return;

    Promise.all(
      withWallets.map(async (c) => {
        const id = getCustomerId(c);
        const res = await fetch(apiUrl(`/api/customers/${id}/wallet`));
        return res.ok ? [id, await res.json()] : null;
      }),
    ).then((entries) => {
      const found = entries.filter(Boolean);
      setPayoutCharges(Object.fromEntries(found.map(([id, w]) => [id, w.payoutCharges])));
      setWalletBalances(Object.fromEntries(found.map(([id, w]) => [id, w.currentBalance])));
      setWalletIds(Object.fromEntries(found.map(([id, w]) => [id, w.Id])));
    });
  };

  useEffect(refreshWallets, [customers]);

  const startEditPayout = (id) => {
    setPayoutError(null);
    setEditingPayoutId(id);
    setPayoutInput(String(payoutCharges[id] ?? ''));
  };

  const cancelEditPayout = () => {
    setEditingPayoutId(null);
    setPayoutInput('');
  };

  const handleSavePayout = async (id) => {
    const value = Number(payoutInput);
    if (payoutInput === '' || Number.isNaN(value) || value < 0) {
      setPayoutError('Enter a valid payout charge.');
      return;
    }

    setPayoutBusyId(id);
    setPayoutError(null);

    try {
      const res = await fetch(apiUrl(`/api/customers/${id}/wallet/payout-charges`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutCharges: value }),
      });

      if (res.ok) {
        const wallet = await res.json();
        setPayoutCharges((prev) => ({ ...prev, [id]: wallet.payoutCharges }));
        setEditingPayoutId(null);
        setPayoutInput('');
      } else {
        const problem = await res.json().catch(() => null);
        setPayoutError(problem?.message ?? `Failed to update payout charges (${res.status}).`);
      }
    } catch (err) {
      setPayoutError(err.message);
    } finally {
      setPayoutBusyId(null);
    }
  };

  const confirmDelete = (customer) => {
    setDeleteError(null);
    setDeletingCustomer(customer);
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    const id = getCustomerId(deletingCustomer);
    setDeleteBusy(true);
    setDeleteError(null);

    try {
      const res = await fetch(apiUrl(`/api/customers/${id}`), { method: 'DELETE' });

      if (res.status === 204 || res.status === 404) {
        setCustomers((prev) => prev.filter((c) => getCustomerId(c) !== id));
        setDeletingCustomer(null);
      } else {
        setDeleteError(`Delete failed (${res.status}).`);
      }
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleAddWallet = async (id) => {
    setWalletBusyId(id);
    setWalletError(null);

    try {
      const res = await fetch(apiUrl(`/api/customers/${id}/wallet`), { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setCustomers((prev) => prev.map((c) => (getCustomerId(c) === id ? updated : c)));
      } else {
        const problem = await res.json().catch(() => null);
        setWalletError(problem?.message ?? `Failed to add wallet (${res.status}).`);
      }
    } catch (err) {
      setWalletError(err.message);
    } finally {
      setWalletBusyId(null);
    }
  };

  const openTransfer = (customer) => {
    setTransferTarget(customer);
    setTransferAmount('');
    setTransferError(null);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    const amount = Number(transferAmount);
    if (!transferAmount || Number.isNaN(amount) || amount <= 0) {
      setTransferError('Enter a valid amount.');
      return;
    }

    const toId = getCustomerId(transferTarget);
    const toWalletId = walletIds[toId];
    setTransferSubmitting(true);
    setTransferError(null);

    try {
      const res = await fetch(apiUrl(`/api/customers/${user.id}/wallet/transfer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toWalletId, amount }),
      });

      if (res.ok) {
        const data = await res.json();
        setTransferReceipt({
          transferId: data.transferId,
          dateTime: new Date().toLocaleString(),
          fromName: user.FULL_NAME,
          toName: transferTarget.FULL_NAME,
          amount,
        });
        setTransferTarget(null);
        refreshWallets();
        onWalletChanged?.();
      } else {
        const problem = await res.json().catch(() => null);
        setTransferError(problem?.message ?? problem?.detail ?? `Transfer failed (${res.status}).`);
      }
    } catch (err) {
      setTransferError(err.message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  // ── Derived view data: summary figures, the search/role filter, and the current page ──
  const isRetailer = (c) => (c.roleName || '').toLowerCase() === 'retailer';
  const needle = query.trim().toLowerCase();
  const filtered = customers.filter((c) => {
    if (roleFilter === 'retailer' && !isRetailer(c)) return false;
    if (roleFilter === 'admin' && isRetailer(c)) return false;
    if (!needle) return true;
    return [c.FULL_NAME, c.MOBILE_NUMBER, c.PAN, c.EMAIL_ID, c.STORE_NAME]
      .some((v) => String(v ?? '').toLowerCase().includes(needle));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const withWallet = customers.filter((c) => c.username);
  const balancesLoaded = withWallet.length > 0 && withWallet.every((c) => walletBalances[getCustomerId(c)] !== undefined);
  const totalBalance = withWallet.reduce((sum, c) => sum + Number(walletBalances[getCustomerId(c)] ?? 0), 0);
  const stats = [
    { label: 'Total customers', value: customers.length, Icon: Users, tone: 'blue' },
    { label: 'Retailers', value: customers.filter(isRetailer).length, Icon: Wallet, tone: 'orange' },
    { label: 'With a wallet', value: withWallet.length, Icon: CheckCircle2, tone: 'green' },
    { label: 'Total wallet balance', value: balancesLoaded ? rupees(totalBalance) : '…', Icon: CreditCard, tone: 'blue' },
  ];

  const roleTabs = [
    { key: 'all', label: 'All', count: customers.length },
    { key: 'retailer', label: 'Retailers', count: customers.filter(isRetailer).length },
    { key: 'admin', label: 'Admins', count: customers.filter((c) => !isRetailer(c)).length },
  ];

  return (
    <div className="cu-page">
      <div className="cu-inner">
        {/* Header: title and the one primary action */}
        <header className="cu-head">
          <div className="cu-head-text">
            <button type="button" className="cu-back" onClick={() => onNavigate?.('home')} aria-label="Back to home">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="cu-title">Customers</h1>
              <p className="cu-subtitle">Everyone on your account — wallets, payouts and reports in one place.</p>
            </div>
          </div>
          <button type="button" className="cu-add" onClick={() => onNavigate?.('customerDetail', { mode: 'create' })}>
            <Plus size={16} strokeWidth={2.5} /> Add Customer
          </button>
        </header>

        {!loading && !error && customers.length > 0 && (
          <>
            {/* At-a-glance figures */}
            <div className="cu-stats">
              {stats.map(({ label, value, Icon, tone }) => (
                <div key={label} className={`cu-stat cu-stat--${tone}`}>
                  <span className="cu-stat-icon"><Icon size={20} strokeWidth={2} /></span>
                  <div>
                    <p className="cu-stat-label">{label}</p>
                    <p className="cu-stat-value">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Search and role filter */}
            <div className="cu-toolbar">
              <div className="cu-tabs" role="tablist" aria-label="Filter by role">
                {roleTabs.map((t) => (
                  <button
                    key={t.key} type="button" role="tab" aria-selected={roleFilter === t.key}
                    className={`cu-tab${roleFilter === t.key ? ' is-active' : ''}`}
                    onClick={() => { setRoleFilter(t.key); setPage(1); }}
                  >
                    {t.label} <span>{t.count}</span>
                  </button>
                ))}
              </div>
              <div className="cu-search">
                <Search size={16} className="cu-search-icon" />
                <input
                  type="text" value={query} placeholder="Search name, mobile, PAN, email or store"
                  aria-label="Search customers" autoComplete="off"
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                />
                {query && (
                  <button type="button" className="cu-search-clear" onClick={() => { setQuery(''); setPage(1); }} aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Content */}
        {loading && <p className="cu-state">Loading customers…</p>}

        {!loading && error && <p className="cu-state cu-state--error">Couldn't load customers: {error}</p>}

        {!loading && !error && customers.length === 0 && (
          <div className="cu-empty">
            <span className="cu-empty-icon"><Users size={24} strokeWidth={1.8} /></span>
            <p className="cu-empty-title">No customers yet</p>
            <p className="cu-empty-text">Use “Add Customer” above to create the first one.</p>
          </div>
        )}

        {!loading && !error && walletError && <p style={{ ...fieldErrorStyle, marginBottom: 12 }}>{walletError}</p>}
        {!loading && !error && payoutError && <p style={{ ...fieldErrorStyle, marginBottom: 12 }}>{payoutError}</p>}

        {!loading && !error && customers.length > 0 && filtered.length === 0 && (
          <div className="cu-empty">
            <span className="cu-empty-icon"><Search size={22} strokeWidth={1.8} /></span>
            <p className="cu-empty-title">No customers match</p>
            <p className="cu-empty-text">Try a different name, number or filter.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="cu-card">
            <div className="table-scroll cu-scroll">
              <table className="cu-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>PAN</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>Store</th>
                    <th className="is-num">Wallet</th>
                    <th>Transfer</th>
                    <th>Payout Charges</th>
                    <th>Actions</th>
                    <th>Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => {
                    const id = getCustomerId(c);
                    return (
                      <tr key={id}>
                        <td>
                          <div className="cu-person">
                            <Avatar name={c.FULL_NAME} size={36} />
                            <div className="cu-person-text">
                              <span className="cu-person-name">{c.FULL_NAME}</span>
                              {c.roleName && <span className={`cu-role cu-role--${isRetailer(c) ? 'retailer' : 'admin'}`}>{c.roleName}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="cu-mono">{c.PAN}</td>
                        <td className="cu-nowrap">+91 {c.MOBILE_NUMBER}</td>
                        <td><span className="cu-email" title={c.EMAIL_ID}>{c.EMAIL_ID}</span></td>
                        <td><span className="cu-store" title={c.STORE_NAME}>{c.STORE_NAME}</span></td>
                        <td className="is-num">
                          {c.username ? (
                            <span className="cu-balance">{rupees(walletBalances[id] ?? c.lastBalance ?? 0)}</span>
                          ) : (
                            <button
                              type="button" className="cu-chip-btn cu-chip-btn--orange"
                              onClick={() => handleAddWallet(id)} disabled={walletBusyId === id}
                            >
                              <Wallet size={13} /> {walletBusyId === id ? 'Adding…' : 'Add'}
                            </button>
                          )}
                        </td>
                        <td>
                          {c.username ? (
                            <button type="button" className="cu-chip-btn" onClick={() => openTransfer(c)}>
                              <ArrowRightLeft size={13} /> Transfer
                            </button>
                          ) : (
                            <span className="cu-dash">—</span>
                          )}
                        </td>
                        <td>
                          {!c.username ? (
                            <span className="cu-dash">—</span>
                          ) : editingPayoutId === id ? (
                            <div className="cu-payout-edit">
                              <input
                                type="text" inputMode="decimal" autoFocus value={payoutInput} aria-label="Payout charge"
                                onChange={(e) => setPayoutInput(e.target.value.replace(/[^0-9.]/g, ''))}
                              />
                              <button type="button" className="icon-btn-anim" title="Save" onClick={() => handleSavePayout(id)} disabled={payoutBusyId === id} style={iconBtnStyle}>
                                <Check size={16} color="#38A169" />
                              </button>
                              <button type="button" className="icon-btn-anim" title="Cancel" onClick={cancelEditPayout} disabled={payoutBusyId === id} style={iconBtnStyle}>
                                <X size={16} color="#7C8491" />
                              </button>
                            </div>
                          ) : (
                            <div className="cu-payout">
                              <span>{payoutCharges[id] !== undefined ? `₹${Number(payoutCharges[id]).toFixed(4)}` : '…'}</span>
                              <button type="button" className="icon-btn-anim" title="Edit payout charges" onClick={() => startEditPayout(id)} style={iconBtnStyle}>
                                <Pencil size={14} color="#F26A1B" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="cu-actions">
                            <button type="button" className="cu-icon-btn" title="View" aria-label={`View ${c.FULL_NAME}`} onClick={() => onNavigate?.('customerDetail', { customerId: id, mode: 'view' })}>
                              <Eye size={16} />
                            </button>
                            <button type="button" className="cu-icon-btn" title="Edit" aria-label={`Edit ${c.FULL_NAME}`} onClick={() => onNavigate?.('customerDetail', { customerId: id, mode: 'edit' })}>
                              <Pencil size={16} />
                            </button>
                            <button type="button" className="cu-icon-btn cu-icon-btn--danger" title="Delete" aria-label={`Delete ${c.FULL_NAME}`} onClick={() => confirmDelete(c)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {c.username ? (
                            <button
                              type="button" className="cu-chip-btn"
                              aria-haspopup="menu" aria-expanded={reportMenu?.customer === c}
                              onClick={(e) => (reportMenu?.customer === c ? setReportMenu(null) : openReportMenu(e, c))}
                            >
                              <FileChartColumn size={13} /> Reports <ChevronDown size={12} />
                            </button>
                          ) : (
                            <span className="cu-dash" title="Add a wallet first">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer: how many, and paging when there is more than one page */}
            <div className="cu-foot">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                {filtered.length !== customers.length ? ` (filtered from ${customers.length})` : ''}
              </span>
              {pageCount > 1 && (
                <div className="cu-pager">
                  <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
                    <ChevronLeft size={16} />
                  </button>
                  <span>Page {currentPage} of {pageCount}</span>
                  <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next page">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deletingCustomer && (
        <Modal onClose={() => !deleteBusy && setDeletingCustomer(null)} style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 420, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#FFF5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Trash2 size={20} color="#E53E3E" />
            </div>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0D4FB0', margin: 0 }}>
              Delete Customer
            </h2>
          </div>

          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14.5, color: '#4A5568', marginBottom: deleteError ? 8 : 24 }}>
            Are you sure you want to delete <strong>{deletingCustomer.FULL_NAME}</strong>? This permanently
            removes the record and can't be undone.
          </p>

          {deleteError && <p style={{ ...fieldErrorStyle, marginBottom: 16 }}>{deleteError}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleDelete}
              disabled={deleteBusy}
              style={{
                background: '#E53E3E',
                color: '#ffffff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 14,
                cursor: deleteBusy ? 'default' : 'pointer',
                opacity: deleteBusy ? 0.7 : 1,
              }}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDeletingCustomer(null)}
              disabled={deleteBusy}
              style={{
                background: 'none',
                border: '1px solid rgba(1,87,111,0.15)',
                borderRadius: 12,
                padding: '12px 24px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                color: '#4A5568',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Wallet-to-wallet transfer modal */}
      {transferTarget && (
        <Modal onClose={() => !transferSubmitting && setTransferTarget(null)} style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 380, maxWidth: '90vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#0D4FB0', margin: '0 0 4px' }}>
            Transfer to {transferTarget.FULL_NAME}
          </h2>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#7C8491', margin: '0 0 16px' }}>
            From your own wallet balance.
          </p>
          <form onSubmit={handleTransfer}>
            <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10.5, letterSpacing: '1.5px', color: '#7C8491', marginBottom: 7, textTransform: 'uppercase' }}>
              Amount
            </label>
            <input
              type="text" inputMode="numeric" className="form-input no-icon" placeholder="e.g. 500" autoFocus
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              style={{ marginBottom: 16 }}
            />
            {transferError && <p style={fieldErrorStyle}>{transferError}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="signin-btn" disabled={transferSubmitting} style={{ width: 'auto', padding: '0 20px', height: 38 }}>
                {transferSubmitting ? 'Transferring…' : 'Transfer'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setTransferTarget(null)}
                disabled={transferSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transfer success receipt */}
      {transferReceipt && (
        <Modal onClose={() => setTransferReceipt(null)} style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 380, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
            <CheckCircle2 size={40} color="#38A169" style={{ marginBottom: 10 }} />
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 17, color: '#0D4FB0', margin: 0 }}>
              Transfer Successful
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 10, fontFamily: 'Inter, sans-serif', fontSize: 13.5 }}>
            <span style={{ color: '#9CA3AF' }}>Transfer ID</span>
            <strong style={{ color: '#0D4FB0' }}>{transferReceipt.transferId ?? '—'}</strong>

            <span style={{ color: '#9CA3AF' }}>Date</span>
            <strong style={{ color: '#0D4FB0' }}>{transferReceipt.dateTime}</strong>

            <span style={{ color: '#9CA3AF' }}>From</span>
            <strong style={{ color: '#0D4FB0' }}>{transferReceipt.fromName}</strong>

            <span style={{ color: '#9CA3AF' }}>To</span>
            <strong style={{ color: '#0D4FB0' }}>{transferReceipt.toName}</strong>

            <span style={{ color: '#9CA3AF' }}>Amount</span>
            <strong style={{ color: '#F26A1B' }}>₹{Number(transferReceipt.amount).toFixed(2)}</strong>
          </div>

          <button
            type="button"
            onClick={() => setTransferReceipt(null)}
            className="signin-btn"
            style={{ width: '100%', height: 38, marginTop: 20 }}
          >
            Close
          </button>
        </Modal>
      )}

      {reportMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onMouseDown={() => setReportMenu(null)} />
          <div
            role="menu"
            style={{
              position: 'fixed', left: reportMenu.left, top: reportMenu.top, width: REPORT_MENU_WIDTH, zIndex: 50, padding: 8,
              background: '#fff', border: '1px solid #E5E9F0', borderRadius: 14, boxShadow: '0 12px 32px rgba(13, 79, 176, 0.16)',
            }}
          >
            {CUSTOMER_REPORTS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                className="btn-ghost"
                onClick={() => {
                  const customer = reportMenu.customer;
                  const id = getCustomerId(customer);
                  const walletId = walletIds[id] ?? customer.walletId;
                  setReportMenu(null);
                  if (!walletId) {
                    window.alert('This customer’s wallet is still loading — try again in a moment.');
                    return;
                  }
                  onNavigate?.('reports', { report: key, customerId: id, customer: { id, walletId, name: customer.FULL_NAME } });
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, padding: '0 12px', borderRadius: 9,
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5, color: '#12284A',
                }}
              >
                <Icon size={16} color="#1565D8" /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomersPage;
