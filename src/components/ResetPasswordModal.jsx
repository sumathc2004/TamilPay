import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import Modal from './Modal';
import { apiUrl } from '../utils/api';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';

/**
 * Admin: set a new wallet password and/or transaction PIN for a customer, without the old ones.
 * Leave a box empty to keep that one. Pressing the button only asks to confirm — nothing is sent
 * until the confirmation is accepted.
 */
const ResetPasswordModal = ({ customerId, name, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const problem = () => {
    if (!password && !pin) return 'Enter a new password, a new PIN, or both.';
    if (password && password.length < 6) return 'The password must be at least 6 characters.';
    if (password && password !== confirm) return 'The two passwords do not match.';
    if (pin && !/^\d{4}$/.test(pin)) return 'The PIN must be exactly 4 digits.';
    return '';
  };

  const next = () => {
    const issue = problem();
    if (issue) { setError(issue); return; }
    setError('');
    setConfirming(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/customers/${customerId}/wallet/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password || null, newPin: pin || null }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.message ?? body?.detail ?? `It didn't go through (${res.status}).`);
        setConfirming(false);
        return;
      }
      setDone(body?.message ?? 'Reset.');
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={() => !submitting && onClose()} style={{ padding: 'clamp(20px, 5vw, 28px)', width: 420, maxWidth: '92vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#172033', margin: 0 }}>
          <KeyRound size={18} color="#0D4FB0" /> Reset password
        </h2>
        <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
          <X size={18} color="#7C8491" />
        </button>
      </div>

      {done ? (
        <div style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#38A169', margin: '6px 0 6px' }}>{done}</p>
          <p style={{ fontSize: 13.5, color: '#4A5568', margin: '0 0 18px' }}>{name} can sign in with the new details now.</p>
          <button type="button" className="signin-btn" onClick={onClose} style={{ height: 40, padding: '0 24px' }}>Done</button>
        </div>
      ) : (
        <>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#7C8491', margin: '0 0 14px' }}>
            For <strong style={{ color: '#172033' }}>{name}</strong>. Fill in only what you want to change.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>New password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input no-icon" type={showPw ? 'text' : 'password'} value={password} autoComplete="new-password"
                onChange={(e) => { setPassword(e.target.value); setConfirming(false); }} placeholder="Leave empty to keep" style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide' : 'Show'}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                {showPw ? <EyeOff size={17} color="#B0B8C4" /> : <Eye size={17} color="#B0B8C4" />}
              </button>
            </div>
          </div>

          {password && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Confirm new password</label>
              <input className="form-input no-icon" type={showPw ? 'text' : 'password'} value={confirm} autoComplete="new-password"
                onChange={(e) => { setConfirm(e.target.value); setConfirming(false); }} placeholder="Type it again" />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>New 4-digit PIN</label>
            <input
              className="form-input no-icon" inputMode="numeric" maxLength={4} value={pin} autoComplete="off" placeholder="Leave empty to keep"
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setConfirming(false); }}
            />
          </div>

          {error && <p role="alert" style={fieldErrorStyle}>{error}</p>}

          {confirming && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#B7791F', background: '#FEF6E4', borderRadius: 10, padding: '10px 12px', margin: '0 0 12px' }}>
              This changes {name}&apos;s {password && pin ? 'password and PIN' : password ? 'password' : 'PIN'} straight away. Their old {password && pin ? 'ones stop' : 'one stops'} working.
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" className="signin-btn" onClick={() => (confirming ? setConfirming(false) : onClose())} disabled={submitting}
              style={{ flex: 1, height: 42, background: '#ffffff', color: '#0D4FB0', border: '1px solid rgba(13,79,176,0.25)' }}>
              {confirming ? 'Back' : 'Cancel'}
            </button>
            <button type="button" className="signin-btn" disabled={submitting} onClick={() => (confirming ? submit() : next())}
              style={{ flex: 1, height: 42, background: confirming ? '#DC2626' : undefined }}>
              {submitting ? 'Resetting…' : confirming ? 'Confirm reset' : 'Reset'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default ResetPasswordModal;
