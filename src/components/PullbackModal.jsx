import React, { useEffect, useMemo, useState } from 'react';
import { HandCoins, X } from 'lucide-react';
import Modal from './Modal';
import SearchSelect from './SearchSelect';
import { apiUrl } from '../utils/api';
import { MASTER_CLIENT_ID } from '../utils/customer';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';

const money = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Admin: pull money back from a retailer's wallet into the admin's own wallet. Choosing the
 * retailer shows their balance; pressing "Pull back" only asks to confirm — nothing is sent
 * until the confirmation is accepted.
 */
const PullbackModal = ({ user, onClose, onDone, presetCustomerId = null }) => {
  // Admin only, whatever opened it.
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';
  const [retailers, setRetailers] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [adminWalletId, setAdminWalletId] = useState(user?.walletId || null);

  const [walletId, setWalletId] = useState('');
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const loadBalance = (customerId) => {
    fetch(apiUrl(`/api/customers/${customerId}/wallet`))
      .then((res) => (res.ok ? res.json() : null))
      .then((wallet) => setBalance(wallet?.currentBalance ?? null))
      .catch(() => setBalance(null));
  };

  useEffect(() => {
    fetch(apiUrl(`/api/customers/retailers?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then((list) => {
        setRetailers(list);
        // Opened from a customer's row: that retailer is already chosen.
        const preset = presetCustomerId == null ? null : list.find((r) => r.customerId === presetCustomerId);
        if (preset) { setWalletId(preset.walletId); loadBalance(preset.customerId); }
      })
      .catch((err) => setLoadError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The session's walletId is 0 for most accounts, so the admin's wallet is looked up.
  useEffect(() => {
    if (adminWalletId || !user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}/wallet`))
      .then((res) => (res.ok ? res.json() : null))
      .then((wallet) => { if (wallet?.Id) setAdminWalletId(wallet.Id); else setLoadError('No wallet is linked to your account.'); })
      .catch((err) => setLoadError(err.message));
  }, [adminWalletId, user?.id]);

  const options = useMemo(
    () => (retailers ?? [])
      .filter((r) => r.walletId !== adminWalletId)
      .map((r) => ({ value: r.walletId, label: r.fullName, hint: r.storeName })),
    [retailers, adminWalletId],
  );
  const retailer = retailers?.find((r) => String(r.walletId) === String(walletId));

  const pick = (id) => {
    setWalletId(id);
    setBalance(null);
    setConfirming(false);
    setError(null);
    const chosen = retailers?.find((r) => String(r.walletId) === String(id));
    if (chosen) loadBalance(chosen.customerId);
  };

  const value = Number(amount);
  const amountError = amount === '' ? null
    : Number.isNaN(value) || value <= 0 ? 'Enter a valid amount.'
      : balance != null && value > balance ? `This retailer only has ${money(balance)}.`
        : null;
  const canContinue = Boolean(walletId && adminWalletId && amount !== '' && !amountError);

  const submit = async () => {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/admin/pullback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: Number(walletId), adminWalletId, amount: value, remarks: remarks.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? body?.detail ?? `The pullback did not go through (${res.status}).`);
        setConfirming(false);
        return;
      }
      setDone({ message: body?.message ?? 'Pullback successful.', amount: body?.amount ?? value, name: retailer?.fullName });
      onDone?.();
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <Modal onClose={() => !submitting && onClose()} themeClassName="theme-purple" style={{ padding: 'clamp(20px, 5vw, 28px)', width: 440, maxWidth: '92vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--theme-heading)', margin: 0 }}>
          <HandCoins size={18} /> Pull back from a retailer
        </h2>
        <button type="button" className="icon-btn-anim" onClick={onClose} disabled={submitting} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
          <X size={18} color="#7C8491" />
        </button>
      </div>

      {done ? (
        <div style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <p style={{ fontWeight: 700, fontSize: 17, color: '#38A169', margin: '4px 0 6px' }}>Pullback successful</p>
          <p style={{ fontSize: 13.5, color: '#4A5568', margin: '0 0 18px' }}>
            {money(done.amount)} was pulled back{done.name ? ` from ${done.name}` : ''} into your wallet.
          </p>
          <button type="button" className="signin-btn" onClick={onClose} style={{ height: 40, padding: '0 24px' }}>Done</button>
        </div>
      ) : (
        <>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: '0 0 14px' }}>
            Moves money out of the retailer&apos;s wallet and into yours.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Retailer</label>
            {presetCustomerId != null ? (
              // Opened from a customer's own row: the retailer is already known, so nothing to search.
              <div style={{ background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.1)', borderRadius: 12, padding: '10px 14px', fontFamily: 'Inter, sans-serif' }}>
                {retailer ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: 'var(--theme-heading)' }}>{retailer.fullName}</p>
                    {retailer.storeName && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#6B7280' }}>{retailer.storeName}</p>}
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#7C8491' }}>{loadError ?? 'Loading…'}</p>
                )}
              </div>
            ) : (
              <SearchSelect
                options={options} value={walletId} onChange={pick} loading={!retailers && !loadError}
                placeholder="Type a retailer name or store" emptyText="No retailer matches." minWidth={0}
              />
            )}
            {balance != null && retailer && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#7C8491', margin: '6px 0 0' }}>
                Current balance: <strong style={{ color: balance < 0 ? '#E53E3E' : 'var(--theme-heading)' }}>{money(balance)}</strong>
              </p>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Amount</label>
            <input
              type="text" inputMode="decimal" className="form-input no-icon" placeholder="e.g. 5000" value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                if (/^\d*(\.\d{0,2})?$/.test(v)) { setAmount(v); setConfirming(false); setError(null); }
              }}
            />
            {amountError && <p style={{ ...fieldErrorStyle, marginTop: 6 }}>{amountError}</p>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Reason (optional)</label>
            <input
              className="form-input no-icon" maxLength={200} placeholder="Admin pullback" value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {loadError && <p style={fieldErrorStyle}>{loadError}</p>}
          {error && <p role="alert" style={fieldErrorStyle}>{error}</p>}

          {confirming && canContinue && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#B7791F', background: '#FEF6E4', borderRadius: 10, padding: '10px 12px', margin: '0 0 12px' }}>
              {money(value)} will be taken from <strong>{retailer?.fullName}</strong>
              {retailer?.storeName ? ` (${retailer.storeName})` : ''} and added to your wallet. This can&apos;t be undone from here.
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button" className="signin-btn" onClick={() => (confirming ? setConfirming(false) : onClose())} disabled={submitting}
              style={{ flex: 1, height: 42, background: '#ffffff', color: 'var(--theme-heading)', border: '1px solid rgba(var(--theme-heading-rgb),0.2)' }}
            >
              {confirming ? 'Back' : 'Cancel'}
            </button>
            <button
              type="button" className="signin-btn" disabled={!canContinue || submitting}
              onClick={() => (confirming ? submit() : setConfirming(true))}
              style={{ flex: 1, height: 42, background: confirming ? '#DC2626' : undefined }}
            >
              {submitting ? 'Pulling back…' : confirming ? 'Confirm pullback' : 'Pull back'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default PullbackModal;
