import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Check, CheckCircle2, Eye, Pencil, Plus, Trash2, Users, Wallet, X } from 'lucide-react';
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
const CustomersPage = ({ onNavigate, user, onWalletChanged }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 'calc(100vh - 64px)',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      {/* ── Soft background diagonal swoosh, matching HomePage ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(255,122,0,0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Page content ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '20px clamp(16px, 5vw, 80px)',
        }}
      >
        {/* Top row: Back link + Add Customer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <button
            className="btn-ghost"
            onClick={() => onNavigate?.('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#7C8491',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              padding: 0,
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>

          <button
            onClick={() => onNavigate?.('customerDetail', { mode: 'create' })}
            className="signin-btn"
            style={{ width: 'auto', padding: '0 16px', height: 34, fontSize: 13 }}
          >
            <Plus size={14} strokeWidth={2.5} /> Add Customer
          </button>
        </div>

        {/* Content */}
        {loading && (
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading customers…</p>
        )}

        {!loading && error && (
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>
            Couldn't load customers: {error}
          </p>
        )}

        {!loading && !error && customers.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(1,87,111,0.06)',
              borderRadius: 20,
              padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
              maxWidth: 520,
              boxShadow: '0 2px 20px rgba(13, 79, 176, 0.08)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#FFF5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Users size={22} color="#F26A1B" strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#0D4FB0', margin: 0 }}>
                No customers yet
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: '4px 0 0' }}>
                Use "Add Customer" above to create the first one.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && walletError && (
          <p style={{ ...fieldErrorStyle, marginBottom: 12 }}>{walletError}</p>
        )}

        {!loading && !error && payoutError && (
          <p style={{ ...fieldErrorStyle, marginBottom: 12 }}>{payoutError}</p>
        )}

        {!loading && !error && customers.length > 0 && (
          <div
            className="table-scroll"
            style={{
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(1,87,111,0.06)',
              borderRadius: 20,
              boxShadow: '0 2px 20px rgba(13, 79, 176, 0.08)',
              overflowY: 'hidden',
            }}
          >
            <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
              <thead>
                <tr style={{ background: '#F3F7FD', textAlign: 'left' }}>
                  {['Customer', 'PAN', 'Mobile', 'Email', 'Store', 'Wallet', 'Transfer', 'Payout Charges', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '14px 20px',
                        fontSize: 11,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        color: '#7C8491',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const id = getCustomerId(c);
                  return (
                    <tr key={id} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                      <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={c.FULL_NAME} size={32} />
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                            <span style={{ color: '#0D4FB0', fontWeight: 600 }}>{c.FULL_NAME}</span>
                            {c.roleName && (
                              <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: 12.5 }}>({c.roleName})</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#4A5568' }}>{c.PAN}</td>
                      <td style={{ padding: '14px 20px', color: '#4A5568', whiteSpace: 'nowrap' }}>+91 {c.MOBILE_NUMBER}</td>
                      <td style={{ padding: '14px 20px', color: '#4A5568' }}>{c.EMAIL_ID}</td>
                      <td style={{ padding: '14px 20px', color: '#4A5568' }}>{c.STORE_NAME}</td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        {c.username ? (
                          <span style={{ color: '#0D4FB0', fontWeight: 700 }}>
                            ₹{Number(walletBalances[id] ?? c.lastBalance ?? 0).toFixed(4)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleAddWallet(id)}
                            disabled={walletBusyId === id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#FFF5EB',
                              border: 'none',
                              borderRadius: 8,
                              cursor: walletBusyId === id ? 'default' : 'pointer',
                              color: '#F26A1B',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 700,
                              fontSize: 12.5,
                              padding: '7px 12px',
                              opacity: walletBusyId === id ? 0.6 : 1,
                            }}
                          >
                            <Wallet size={13} /> {walletBusyId === id ? 'Adding…' : 'Add'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        {c.username ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => openTransfer(c)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: '#F3F7FD', border: '1px solid rgba(1,87,111,0.1)', borderRadius: 8,
                              cursor: 'pointer', color: '#0D4FB0', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                              fontSize: 12.5, padding: '7px 12px',
                            }}
                          >
                            <ArrowRightLeft size={13} /> Transfer
                          </button>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        {!c.username ? (
                          <span style={{ color: '#9CA3AF' }}>—</span>
                        ) : editingPayoutId === id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              autoFocus
                              value={payoutInput}
                              onChange={(e) => setPayoutInput(e.target.value.replace(/[^0-9.]/g, ''))}
                              style={{
                                width: 80,
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '1px solid rgba(1,87,111,0.15)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: 13,
                              }}
                            />
                            <button
                              type="button"
                              className="icon-btn-anim"
                              title="Save"
                              onClick={() => handleSavePayout(id)}
                              disabled={payoutBusyId === id}
                              style={iconBtnStyle}
                            >
                              <Check size={16} color="#38A169" />
                            </button>
                            <button
                              type="button"
                              className="icon-btn-anim"
                              title="Cancel"
                              onClick={cancelEditPayout}
                              disabled={payoutBusyId === id}
                              style={iconBtnStyle}
                            >
                              <X size={16} color="#7C8491" />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#0D4FB0', fontWeight: 700 }}>
                              {payoutCharges[id] !== undefined ? `₹${Number(payoutCharges[id]).toFixed(4)}` : '…'}
                            </span>
                            <button
                              type="button"
                              className="icon-btn-anim"
                              title="Edit payout charges"
                              onClick={() => startEditPayout(id)}
                              style={iconBtnStyle}
                            >
                              <Pencil size={14} color="#F26A1B" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="icon-btn-anim"
                            title="View"
                            onClick={() => onNavigate?.('customerDetail', { customerId: id, mode: 'view' })}
                            style={iconBtnStyle}
                          >
                            <Eye size={16} color="#4A5568" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn-anim"
                            title="Edit"
                            onClick={() => onNavigate?.('customerDetail', { customerId: id, mode: 'edit' })}
                            style={iconBtnStyle}
                          >
                            <Pencil size={16} color="#F26A1B" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn-anim"
                            title="Delete"
                            onClick={() => confirmDelete(c)}
                            style={iconBtnStyle}
                          >
                            <Trash2 size={16} color="#E53E3E" />
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
    </div>
  );
};

export default CustomersPage;
