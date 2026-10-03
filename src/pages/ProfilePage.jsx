import React, { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck, Store, UserRound, Wallet } from 'lucide-react';
import { apiUrl } from '../utils/api';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.08)',
  padding: 'clamp(18px, 4vw, 26px)',
};

const sectionTitle = {
  display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px',
  fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--theme-heading)',
};

const DetailRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', gap: 12, padding: '11px 0', borderTop: '1px solid rgba(var(--theme-heading-rgb),0.06)' }}>
    <Icon size={16} color="#8A93A4" style={{ marginTop: 2, flexShrink: 0 }} />
    <div style={{ minWidth: 0 }}>
      <div style={{ ...labelStyle, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#1F2937', overflowWrap: 'anywhere' }}>
        {value || '—'}
      </div>
    </div>
  </div>
);

// A password-style input with a show/hide toggle. `digits` limits it to a 4-digit PIN.
const SecretField = ({ label, value, onChange, digits = false, autoComplete }) => {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={shown ? 'text' : 'password'}
          className="form-input no-icon"
          value={value}
          inputMode={digits ? 'numeric' : undefined}
          maxLength={digits ? 4 : 50}
          autoComplete={autoComplete}
          onChange={(e) => onChange(digits ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)}
          style={{ paddingRight: 42 }}
        />
        <button
          type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide' : 'Show'}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
        >
          {shown ? <EyeOff size={17} color="#B0B8C4" /> : <Eye size={17} color="#B0B8C4" />}
        </button>
      </div>
    </div>
  );
};

const submitStyle = { width: 'auto', padding: '0 22px', height: 40 };
const cancelStyle = { background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5 };

/**
 * Profile (opened from the top-bar account menu): who is signed in, plus Change Password
 * and Change PIN. The remote changes password and PIN together in one call, so each form
 * sends the value it is not changing as both the old and the new one.
 */
const ProfilePage = ({ user, onNavigate }) => {
  const [customer, setCustomer] = useState(null);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}`)).then((r) => (r.ok ? r.json() : null)).then(setCustomer).catch(() => {});
    fetch(apiUrl(`/api/customers/${user.id}/wallet`)).then((r) => (r.ok ? r.json() : null)).then(setWallet).catch(() => {});
  }, [user]);

  // Which form is showing: 'password' | 'pin' | null. Each is hidden until its button is clicked.
  const [openForm, setOpenForm] = useState(null);
  const toggleForm = (name) => {
    setOpenForm((cur) => (cur === name ? null : name));
    setPw({ current: '', next: '', confirm: '', pin: '' });
    setPn({ password: '', current: '', next: '', confirm: '' });
    setPwStatus(null);
    setPnStatus(null);
  };

  const [pw, setPw] = useState({ current: '', next: '', confirm: '', pin: '' });
  const [pwStatus, setPwStatus] = useState(null); // { ok, text }
  const [pwBusy, setPwBusy] = useState(false);

  const [pn, setPn] = useState({ password: '', current: '', next: '', confirm: '' });
  const [pnStatus, setPnStatus] = useState(null);
  const [pnBusy, setPnBusy] = useState(false);

  const send = async (body) => {
    try {
      const res = await fetch(apiUrl(`/api/customers/${user.id}/wallet/credentials`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) return { ok: true, text: data?.message || 'Updated.' };
      const firstValidation = data?.errors && Object.values(data.errors).flat()[0];
      return { ok: false, text: firstValidation ?? data?.message ?? `Failed (${res.status}).` };
    } catch (err) {
      return { ok: false, text: err.message };
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!pw.current) return setPwStatus({ ok: false, text: 'Enter your current password.' });
    if (pw.next.length < 6) return setPwStatus({ ok: false, text: 'The new password must be at least 6 characters.' });
    if (pw.next !== pw.confirm) return setPwStatus({ ok: false, text: 'The new passwords do not match.' });
    if (!/^\d{4}$/.test(pw.pin)) return setPwStatus({ ok: false, text: 'Enter your current 4-digit PIN to confirm.' });
    setPwBusy(true);
    setPwStatus(null);
    const result = await send({ oldPassword: pw.current, oldPasspin: pw.pin, newPassword: pw.next, newPasspin: pw.pin });
    setPwStatus(result);
    if (result.ok) setPw({ current: '', next: '', confirm: '', pin: '' });
    setPwBusy(false);
  };

  const changePin = async (e) => {
    e.preventDefault();
    if (!pn.password) return setPnStatus({ ok: false, text: 'Enter your current password.' });
    if (!/^\d{4}$/.test(pn.current)) return setPnStatus({ ok: false, text: 'Enter your current 4-digit PIN.' });
    if (!/^\d{4}$/.test(pn.next)) return setPnStatus({ ok: false, text: 'The new PIN must be 4 digits.' });
    if (pn.next !== pn.confirm) return setPnStatus({ ok: false, text: 'The new PINs do not match.' });
    setPnBusy(true);
    setPnStatus(null);
    const result = await send({ oldPassword: pn.password, oldPasspin: pn.current, newPassword: pn.password, newPasspin: pn.next });
    setPnStatus(result);
    if (result.ok) setPn({ password: '', current: '', next: '', confirm: '' });
    setPnBusy(false);
  };

  const name = customer?.FULL_NAME ?? user?.FULL_NAME ?? '';
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';
  const statusLine = (s) => s && (
    <p style={{ ...fieldErrorStyle, color: s.ok ? '#38A169' : '#E53E3E', fontSize: 13, margin: '0 0 12px' }} role="status">{s.text}</p>
  );

  return (
    <div className="theme-purple" style={{ padding: '14px clamp(16px, 3vw, 32px) 28px' }}>
      <button
        type="button" className="btn-ghost" onClick={() => onNavigate?.('home')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 12 }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(20px, 3vw, 26px)', color: 'var(--theme-heading)', margin: '0 0 16px' }}>
        My Profile
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#102A50', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22, fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
              {(name.trim()[0] || (isAdmin ? 'A' : 'R')).toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--theme-heading)', overflowWrap: 'anywhere' }}>{name || '—'}</div>
              <span style={{ display: 'inline-block', marginTop: 4, padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', background: 'var(--theme-tint)', color: 'var(--theme-accent)' }}>
                {user?.roleName || (isAdmin ? 'Admin' : 'Retailer')}
              </span>
            </div>
          </div>

          <DetailRow icon={UserRound} label="Login ID" value={user?.username ?? customer?.username} />
          <DetailRow icon={Phone} label="Mobile" value={customer?.MOBILE_NUMBER ? `+91 ${customer.MOBILE_NUMBER}` : user?.MOBILE_NUMBER ? `+91 ${user.MOBILE_NUMBER}` : ''} />
          <DetailRow icon={Mail} label="Email" value={customer?.EMAIL_ID ?? user?.EMAIL_ID} />
          <DetailRow icon={Store} label="Store" value={[customer?.STORE_NAME ?? user?.STORE_NAME, customer?.STORE_ADDRESS].filter(Boolean).join(' — ')} />
          <DetailRow icon={Wallet} label="Wallet balance" value={wallet?.currentBalance != null ? `₹${Number(wallet.currentBalance).toFixed(2)}` : ''} />
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div style={cardStyle}>
            <h2 style={sectionTitle}><ShieldCheck size={18} color="var(--theme-accent)" /> Security</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[['password', 'Change Password', KeyRound], ['pin', 'Change PIN', ShieldCheck]].map(([key, label, Icon]) => (
                <button
                  key={key} type="button" onClick={() => toggleForm(key)} aria-expanded={openForm === key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13.5,
                    border: '1px solid rgba(var(--theme-heading-rgb),0.12)',
                    background: openForm === key ? 'var(--theme-heading)' : '#F3F7FD',
                    color: openForm === key ? '#fff' : 'var(--theme-heading)',
                  }}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          {openForm === 'password' && <form className="rp-reveal" style={cardStyle} onSubmit={changePassword} noValidate>
            <h2 style={sectionTitle}><KeyRound size={18} color="var(--theme-accent)" /> Change Password</h2>
            <SecretField label="Current password" value={pw.current} onChange={(v) => setPw((s) => ({ ...s, current: v }))} autoComplete="current-password" />
            <SecretField label="New password" value={pw.next} onChange={(v) => setPw((s) => ({ ...s, next: v }))} autoComplete="new-password" />
            <SecretField label="Confirm new password" value={pw.confirm} onChange={(v) => setPw((s) => ({ ...s, confirm: v }))} autoComplete="new-password" />
            <SecretField label="Current PIN (to confirm it's you)" digits value={pw.pin} onChange={(v) => setPw((s) => ({ ...s, pin: v }))} />
            {statusLine(pwStatus)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="signin-btn" disabled={pwBusy} style={submitStyle}>{pwBusy ? 'Updating…' : 'Update password'}</button>
              <button type="button" className="btn-ghost" onClick={() => toggleForm('password')} disabled={pwBusy} style={cancelStyle}>Cancel</button>
            </div>
          </form>}

          {openForm === 'pin' && <form className="rp-reveal" style={cardStyle} onSubmit={changePin} noValidate>
            <h2 style={sectionTitle}><ShieldCheck size={18} color="var(--theme-accent)" /> Change PIN</h2>
            <SecretField label="Current password (to confirm it's you)" value={pn.password} onChange={(v) => setPn((s) => ({ ...s, password: v }))} autoComplete="current-password" />
            <SecretField label="Current PIN" digits value={pn.current} onChange={(v) => setPn((s) => ({ ...s, current: v }))} />
            <SecretField label="New PIN" digits value={pn.next} onChange={(v) => setPn((s) => ({ ...s, next: v }))} />
            <SecretField label="Confirm new PIN" digits value={pn.confirm} onChange={(v) => setPn((s) => ({ ...s, confirm: v }))} />
            {statusLine(pnStatus)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="signin-btn" disabled={pnBusy} style={submitStyle}>{pnBusy ? 'Updating…' : 'Update PIN'}</button>
              <button type="button" className="btn-ghost" onClick={() => toggleForm('pin')} disabled={pnBusy} style={cancelStyle}>Cancel</button>
            </div>
          </form>}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
