import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Plus } from 'lucide-react';
import BrandLogo from './BrandLogo';
import Modal from './Modal';
import { apiUrl } from '../utils/api';
import { fieldErrorStyle } from '../styles/formStyles';

const Navbar = ({ onNavigate, user, onLogout, currentPage, onWalletChanged, walletVersion }) => {
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';
  // Role letter, from the role the login API returned: R for Retailer, A for Admin.
  const roleLetter = isAdmin ? 'A' : 'R';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // The login response's lastBalance is only a snapshot from sign-in time, so the
  // live figure is re-fetched on load and on every navigation — cheap enough for a
  // single-field lookup, and it means any wallet update anywhere in the app (a
  // transfer, an admin topping up a wallet) shows up here without a full re-login.
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
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
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
    <nav className="navbar">
      {/* Left: Brand logo */}
      <div style={{ cursor: 'pointer' }} onClick={() => onNavigate?.(user ? 'home' : 'login')}>
        <BrandLogo height="clamp(48px, 7vw, 84px)" />
      </div>

      {/* Right: User profile section — only once someone's actually signed in */}
      {user && (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Wallet balance — hidden on small screens to keep the bar from overflowing */}
        <div className="navbar-wallet" style={{ alignItems: 'center', gap: 8, marginRight: 14 }}>
          {isAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setCreditAmount('');
                setCreditError(null);
                setShowAddCredit(true);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#FFF5EB', border: 'none', borderRadius: 7, cursor: 'pointer',
                color: '#F26A1B', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11,
                padding: '5px 8px',
              }}
            >
              <Plus size={11} /> <span className="navbar-wallet-label">Add Credit</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
            <span
              className="navbar-wallet-label"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: '1px',
                color: '#9CA3AF',
                textTransform: 'uppercase',
              }}
            >
              Wallet
            </span>
            <span
              className="navbar-wallet-amount"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                color: '#0D4FB0',
              }}
            >
              ₹{Number(walletBalance ?? 0).toFixed(2)}
            </span>
          </div>
        </div>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-3 navbar-profile-trigger"
          style={{
            userSelect: 'none',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {/* Role letter badge */}
          <div
            className="navbar-role-badge"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#0D4FB0',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter, sans-serif',
              flexShrink: 0,
            }}
          >
            {roleLetter}
          </div>

          {/* Full name + store name */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, textAlign: 'left' }}>
            <span
              className="navbar-fullname"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                color: '#0D4FB0',
              }}
            >
              {user.FULL_NAME}
            </span>
            <span
              className="navbar-store-name"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                color: '#7C8491',
              }}
            >
              {user.STORE_NAME}
            </span>
            {user.roleName && (
              <span className="navbar-role-name" style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
                ({user.roleName})
              </span>
            )}
          </div>

          {/* Chevron */}
          <ChevronDown
            size={15}
            color="#7C8491"
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </button>

        {/* Sign-out dropdown */}
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 160,
              background: '#ffffff',
              border: '1px solid #E5E9F0',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(13, 79, 176, 0.12)',
              overflow: 'hidden',
              zIndex: 30,
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
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                color: '#E53E3E',
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
      </div>
      )}

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
    </nav>
  );
};

export default Navbar;
