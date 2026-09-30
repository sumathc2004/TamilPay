import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Plus } from 'lucide-react';
import Modal from './Modal';
import { apiUrl } from '../utils/api';
import { fieldErrorStyle } from '../styles/formStyles';

/**
 * Top bar for the signed-in app shell — sits to the right of Sidebar. Carries the
 * wallet balance, Add Credit (admin only), a notification bell (UI-only; there's no
 * notifications backend, so it just tells you there's nothing new instead of faking
 * data), and the profile menu (sign out).
 */
const TopBar = ({ user, onLogout, currentPage, onWalletChanged, walletVersion }) => {
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';
  const roleLetter = isAdmin ? 'A' : 'R';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Re-fetched on load/navigation/wallet-change so any update elsewhere (a transfer,
  // an admin topping up a wallet) shows up here without a full re-login.
  const [walletBalance, setWalletBalance] = useState(user?.lastBalance ?? 0);

  const refreshWalletBalance = () => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}/wallet`))
      .then((res) => (res.ok ? res.json() : null))
      .then((wallet) => {
        if (wallet) setWalletBalance(wallet.currentBalance);
      })
      .catch(() => {});
  };

  useEffect(refreshWalletBalance, [user, currentPage, walletVersion]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeIfOutside = (e) => {
      if (menuOpen && !menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeIfOutside);
    return () => document.removeEventListener('mousedown', closeIfOutside);
  }, [menuOpen]);

  const [showAddCredit, setShowAddCredit] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditError, setCreditError] = useState(null);
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  const handleAddCredit = async (e) => {
    e.preventDefault();
    const amount = Number(creditAmount);
    if (!creditAmount || Number.isNaN(amount) || amount <= 0) {
      setCreditError('Enter a valid amount.');
      return;
    }

    setCreditSubmitting(true);
    setCreditError(null);
    try {
      const res = await fetch(apiUrl(`/api/customers/${user.id}/wallet/credit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (res.ok) {
        refreshWalletBalance();
        onWalletChanged?.();
        setShowAddCredit(false);
        setCreditAmount('');
      } else {
        const problem = await res.json().catch(() => null);
        setCreditError(problem?.message ?? problem?.detail ?? `Failed to add credit (${res.status}).`);
      }
    } catch (err) {
      setCreditError(err.message);
    } finally {
      setCreditSubmitting(false);
    }
  };

  return (
    // Rendered inside the brand bar, so this is just the right-hand cluster —
    // the logo is the left half of that same row.
    <div className="app-topbar">
      <div className="app-topbar-right">
        {isAdmin && (
          <button
            type="button"
            className="app-topbar-addcredit"
            onClick={() => {
              setCreditAmount('');
              setCreditError(null);
              setShowAddCredit(true);
            }}
          >
            <Plus size={13} /> <span>Add Credit</span>
          </button>
        )}

        {/* One line: the label and the figure read as a single statement. */}
        <div className="app-topbar-wallet">
          <span className="app-topbar-wallet-label">Wallet</span>
          <span className="app-topbar-wallet-amount">₹{Number(walletBalance ?? 0).toFixed(2)}</span>
        </div>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="app-topbar-profile"
          >
            <span className="app-topbar-avatar">{roleLetter}</span>

            {/* Name over the login id and role — who you are and which account. */}
            <span className="app-topbar-who">
              <span className="app-topbar-who-name">{user.FULL_NAME}</span>
              <span className="app-topbar-who-sub">
                {user.STORE_NAME || user.username}{user.roleName ? ` (${user.roleName})` : ''}
              </span>
            </span>

            <ChevronDown
              size={16}
              color="#8A93A4"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
            />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 160,
                background: '#ffffff', border: '1px solid #E5E9F0', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(13, 79, 176, 0.12)', overflow: 'hidden', zIndex: 30,
              }}
            >
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout?.();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  fontWeight: 600, fontSize: 14, color: '#E53E3E',
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddCredit && (
        <Modal onClose={() => !creditSubmitting && setShowAddCredit(false)} style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 360, maxWidth: '90vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#0D4FB0', margin: '0 0 16px' }}>
            Add Credit
          </h2>
          <form onSubmit={handleAddCredit}>
            <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10.5, letterSpacing: '1.5px', color: '#7C8491', marginBottom: 7, textTransform: 'uppercase' }}>
              Amount
            </label>
            <input
              type="text" inputMode="numeric" className="form-input no-icon" placeholder="e.g. 500" autoFocus
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              style={{ marginBottom: 16 }}
            />
            {creditError && <p style={fieldErrorStyle}>{creditError}</p>}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="submit" className="signin-btn" disabled={creditSubmitting} style={{ width: 'auto', padding: '0 20px', height: 38 }}>
                {creditSubmitting ? 'Adding…' : 'Add Credit'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowAddCredit(false)}
                disabled={creditSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default TopBar;
