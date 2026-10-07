import React, { useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight, CreditCard, FileChartColumn, Fingerprint, IdCard,
  QrCode, ScanQrCode, SendHorizontal, Settings,
  WalletCards, WalletMinimal, X, Zap,
} from 'lucide-react';
import Modal from '../components/Modal';
import { apiUrl } from '../utils/api';
import { MASTER_CLIENT_ID } from '../utils/customer';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';
import { pick } from '../utils/pick';
import { AnnouncementBanner } from '../components/Announcements';
import '../styles/rupay.css';
import '../styles/instant.css';

// The back of the flip on the Static QR tile: a RuPay-style card (see rupay.css).
const RupayCard = () => (
  <span className="rp-card" aria-hidden="true">
    <i className="rp-chip" />
    <i className="rp-nfc" />
    <i className="rp-flash" />
    <b className="rp-word">Ru<em>Pay</em></b>
  </span>
);

const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const money = (v) => (v != null ? `₹${Number(v).toFixed(2)}` : '—');

// Confirmed directly against a real Qr/GetNext response: {QrId, QrName, Vpa,
// ChargeType, ChargeValue, MinCharge, DailyMaxLimit, DisplayOrder, UsedToday,
// RemainingToday} — there's no image field at all, because GetNext returns the QR's
// configuration, not a rendered code. The scannable image is generated client-side
// from the VPA below, the same way every UPI QR code is built. `pick` still covers a
// couple of casing variants defensively in case a differently-configured QR ever
// comes back shaped slightly differently.
const readQr = (data) => {
  if (!data || typeof data !== 'object') return null;
  const qrId = pick(data, ['QrId', 'qrId', 'Id', 'id']);
  const vpa = pick(data, ['Vpa', 'vpa', 'VPA']);
  if (qrId == null || !vpa) return null;
  return {
    qrId,
    vpa,
    qrName: pick(data, ['QrName', 'qrName']),
    chargeType: pick(data, ['ChargeType', 'chargeType']),
    chargeValue: pick(data, ['ChargeValue', 'chargeValue']),
    minCharge: pick(data, ['MinCharge', 'minCharge']),
    dailyMaxLimit: pick(data, ['DailyMaxLimit', 'dailyMaxLimit']),
    remainingToday: pick(data, ['RemainingToday', 'remainingToday']),
  };
};

const formatCharge = (chargeType, chargeValue) => {
  if (chargeValue == null) return '—';
  return chargeType === 'PERCENT' ? `${chargeValue}%` : money(chargeValue);
};

// Standard UPI deep link — every UPI app (GPay, PhonePe, Paytm, ...) recognizes this
// scheme. No amount ("am") param since this is a static, reusable QR, not tied to one
// payment.
const buildUpiUri = (vpa, payeeName) =>
  `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName || 'TamilPay')}&cu=INR`;

/** Dashboard home — four colored quadrants (Pay In / Verification / Pay Out / More), each a row
 * of tiles. Tiles with a working backend (PG, Static QR, IMPS, Report, Admin) navigate
 * or open a modal; the rest (Dynamic QR, Aadhar/PAN Verification) render visible but inert
 * since there's nothing to wire them to yet. */
const HomePage = ({ onNavigate, user, announcements = [], onOpenAnnouncements }) => {
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';

  const [showQrModal, setShowQrModal] = useState(false);
  const [comingSoon, setComingSoon] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [qrInfo, setQrInfo] = useState(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState(null);

  // Every distinct QR pulled via "Request" (Qr/GetNext) this session, so its VPA can
  // be picked from a dropdown when creating a collect request — there's no separate
  // "list QR codes" endpoint, so this is built up from repeated pulls instead.
  const [qrList, setQrList] = useState([]);
  const [selectedVpa, setSelectedVpa] = useState('');
  const [amount, setAmount] = useState('');
  const [utr, setUtr] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const requestQr = async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await fetch(apiUrl(`/api/qr?clientId=${MASTER_CLIENT_ID}`), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const info = readQr(data);
        setQrInfo(info);

        if (info) {
          setQrList((list) => (list.some((q) => q.qrId === info.qrId) ? list : [...list, { qrId: info.qrId, vpa: info.vpa }]));
          setSelectedVpa(info.vpa);
          try {
            setQrImageDataUrl(await QRCode.toDataURL(buildUpiUri(info.vpa, info.qrName), {
              width: 240, margin: 1, color: { dark: '#0D4FB0', light: '#FFFFFF' },
            }));
          } catch {
            setQrImageDataUrl(null);
          }
        } else {
          setQrImageDataUrl(null);
        }
      } else {
        const problem = await res.json().catch(() => null);
        setQrError(problem?.message ?? `Failed to request a QR code (${res.status}).`);
      }
    } catch (err) {
      setQrError(err.message);
    } finally {
      setQrLoading(false);
    }
  };

  const openQrModal = () => {
    setQrInfo(null);
    setQrImageDataUrl(null);
    setQrError(null);
    setQrList([]);
    setSelectedVpa('');
    setAmount('');
    setUtr('');
    setRemarks('');
    setSubmitError(null);
    setShowQrModal(true);
    requestQr();
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    const amountValue = Number(amount);
    if (!selectedVpa) {
      setSubmitError('Select a VPA.');
      return;
    }
    if (!amount || Number.isNaN(amountValue) || amountValue <= 0) {
      setSubmitError('Enter a valid amount.');
      return;
    }
    if (!utr.trim()) {
      setSubmitError('Enter the UTR.');
      return;
    }

    const entry = qrList.find((q) => q.vpa === selectedVpa);
    setSubmitting(true);
    setSubmitError(null);
    try {
      // The session's walletId is 0 for most accounts (the customer record does not
      // carry it), so a request sent with it is filed against no wallet. The real id
      // comes from the wallet lookup, the same way the PG page resolves it.
      let walletId = user?.walletId;
      if (!walletId && user?.id) {
        const walletRes = await fetch(apiUrl(`/api/customers/${user.id}/wallet`));
        walletId = walletRes.ok ? (await walletRes.json())?.Id : null;
      }
      if (!walletId) {
        setSubmitError('No wallet is linked to this account yet.');
        return;
      }

      const res = await fetch(apiUrl('/api/qr/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          qrId: entry?.qrId,
          vpa: selectedVpa,
          amount: amountValue,
          utr: utr.trim(),
          remarks: remarks.trim(),
        }),
      });

      if (res.ok) {
        const result = await res.json().catch(() => ({}));
        window.alert(result.message || 'Request created.');
        setShowQrModal(false);
      } else {
        const problem = await res.json().catch(() => null);
        setSubmitError(problem?.detail ?? problem?.message ?? `Failed to submit request (${res.status}).`);
      }
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // The same four groups and the same actions as before — only the presentation
  // changes. `tone` picks the panel tint from the two logo hues, alternated so
  // no two panels that touch share a colour. `live` marks what actually opens
  // a screen; the rest say so rather than pretending.
  const sections = [
    {
      key: 'payIn', title: 'Pay In', caption: 'Accept payments from your customers', tone: 'blue',
      items: [
        { label: 'PG', Icon: CreditCard, live: true, onClick: () => onNavigate?.('pg') },
        { label: 'Dynamic QR', Icon: QrCode },
        { label: 'Static QR', Icon: ScanQrCode, live: true, onClick: openQrModal, rupay: true },
      ],
    },
    {
      key: 'payOut', title: 'Pay Out', caption: 'Send money and settle balances', tone: 'orange',
      items: [
        { label: 'IMPS', Icon: SendHorizontal, live: true, onClick: () => onNavigate?.('imps') },
        { label: 'Self Settlement', Icon: WalletMinimal },
        { label: 'Card Payments', Icon: WalletCards, live: true, onClick: () => onNavigate?.('cardPayments'), instant: true },
      ],
    },
    // Keeps the 'bbps' key because the board's grid placement in index.css is keyed on it.
    {
      key: 'bbps', title: 'Verification', caption: 'Verify customer identity', tone: 'amber',
      items: [
        { label: 'Aadhar Verification', Icon: Fingerprint },
        { label: 'PAN Verification', Icon: IdCard },
      ],
    },
    {
      key: 'more', title: 'More', caption: 'Manage and monitor', tone: 'sky',
      items: [
        { label: 'Reports', Icon: FileChartColumn, live: true, onClick: () => onNavigate?.('reports') },
        ...(isAdmin ? [{ label: 'Admin', Icon: Settings, live: true, onClick: () => onNavigate?.('admin') }] : []),
      ],
    },
  ];

  return (
    <div className="tp-page">
      <div className="tp-inner">
        <header className="tp-head">
          <div>
            <h1 className="tp-greeting">Welcome, {(user?.FULL_NAME || '').split(/\s+/)[0] || 'there'}</h1>
            <p className="tp-subgreeting">Here&apos;s what you can do today.</p>
          </div>

          <div className="tp-head-right">
            {/* Announcements pill: first in the right-hand group, beside the date (see .an-pill-btn). */}
            <AnnouncementBanner items={announcements} onOpen={onOpenAnnouncements} />
            <span className="tp-date">{todayLabel()}</span>
          </div>
        </header>


        <div className="tp-body tp-body-panels">
          <div className="tp-board">
            {sections.map((section) => (
              <section key={section.key} className={`tp-panel tp-sec-${section.key} tp-tone-${section.tone}`}>
                <div className="tp-panel-head">
                  <div>
                    <h2 className="tp-panel-title">{section.title}</h2>
                    <p className="tp-panel-caption">{section.caption}</p>
                  </div>
                  {section.items.some((i) => i.live) && (
                    <span className="tp-panel-live">Live <ArrowRight size={13} strokeWidth={2.2} /></span>
                  )}
                </div>

                <div className="tp-panel-items">
                  {section.items.map(({ label, Icon, live, onClick, rupay, instant }) => (
                    <button
                      key={label}
                      type="button"
                      className={`tp-tile${live ? ' is-live' : ''}`}
                      onClick={() => (live ? onClick?.() : setComingSoon(label))}
                    >
                      {instant && <i className="ib-flash" aria-hidden="true" />}
                      {instant ? (
                        // The usual icon, plus the charge-and-strike animation around it (see instant.css).
                        <span className="tp-tile-icon is-instant">
                          <i className="ib-shock" aria-hidden="true" />
                          <Icon size={25} strokeWidth={1.8} />
                          <i className="ib-streak ib-streak-1" aria-hidden="true" />
                          <i className="ib-streak ib-streak-2" aria-hidden="true" />
                          <i className="ib-streak ib-streak-3" aria-hidden="true" />
                          <i className="ib-streak ib-streak-4" aria-hidden="true" />
                          <svg className="ib-lightning" viewBox="0 0 40 60" aria-hidden="true"><path d="M25 1 L5 35 H18 L11 59 L36 22 H22 L31 1 Z" /></svg>
                          {[0, 60, 120, 180, 240, 300].map((deg) => (
                            <i key={deg} className="ib-spark" style={{ '--a': `${deg}deg` }} aria-hidden="true" />
                          ))}
                          <span className="ib-bolt" aria-hidden="true"><Zap size={14} strokeWidth={2.2} fill="currentColor" /></span>
                        </span>
                      ) : rupay ? (
                        <span className="tp-tile-icon is-rupay">
                          <span className="rp-flip">
                            <span className="rp-face rp-front"><Icon size={25} strokeWidth={1.8} /></span>
                            <span className="rp-face rp-back"><RupayCard /></span>
                          </span>
                          <i className="rp-ring" aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="tp-tile-icon"><Icon size={25} strokeWidth={1.8} /></span>
                      )}
                      <span className="tp-tile-title">{label}</span>
                      {instant && (
                        <span className="ib-pill">
                          <Zap size={12} strokeWidth={2.4} fill="currentColor" />
                          <span className="ib-w ib-w1">Instant</span><i className="ib-dot" /><span className="ib-w ib-w2">Super fast</span>
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* A tile with nothing behind it says so, rather than doing nothing. */}
      {comingSoon && (
        <Modal onClose={() => setComingSoon(null)} style={{ padding: '28px 30px', width: 330, maxWidth: '90vw', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Inter, Manrope, sans-serif', fontWeight: 600, fontSize: 17, color: '#111827', margin: '0 0 8px' }}>
            {comingSoon}
          </h2>
          <p style={{ fontFamily: 'Inter, Manrope, sans-serif', fontSize: 13.5, color: '#8A93A4', margin: '0 0 22px', lineHeight: 1.55 }}>
            This service isn&apos;t live yet — there&apos;s no provider connected for it.
            It&apos;s listed so the full catalogue is visible.
          </p>
          <button type="button" className="signin-btn" style={{ width: 'auto', padding: '0 26px', height: 38 }} onClick={() => setComingSoon(null)}>
            Got it
          </button>
        </Modal>
      )}


      {showQrModal && (
        <Modal onClose={() => setShowQrModal(false)} style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 380, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#1565D8', margin: 0 }}>
              Static QR
            </h2>
            <button
              type="button"
              className="icon-btn-anim"
              onClick={() => setShowQrModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
            >
              <X size={18} color="#7C8491" />
            </button>
          </div>

          {qrLoading && !qrInfo && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#7C8491', margin: 0 }}>Loading QR…</p>
          )}

          {qrError && (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#E53E3E', margin: '14px 0 0' }}>
              {qrError}
            </p>
          )}

          {qrInfo && (
            <div style={{ marginTop: 18 }}>
              {qrImageDataUrl ? (
                <img
                  src={qrImageDataUrl}
                  alt={`UPI QR code for ${qrInfo.vpa}`}
                  style={{ width: 220, height: 220, display: 'block', margin: '0 auto', borderRadius: 12, border: '1px solid rgba(21,101,216,0.15)' }}
                />
              ) : (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', textAlign: 'center', margin: 0 }}>
                  Couldn't render the QR image.
                </p>
              )}

              <div style={{ textAlign: 'center', marginTop: 12 }}>
                {qrInfo.qrName && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#1565D8', margin: 0 }}>
                    {qrInfo.qrName}
                  </p>
                )}
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: '2px 0 0' }}>
                  {qrInfo.vpa}
                </p>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Charge', formatCharge(qrInfo.chargeType, qrInfo.chargeValue)],
                  ['Min Charge', money(qrInfo.minCharge)],
                  ['Daily Limit', money(qrInfo.dailyMaxLimit)],
                  ['Remaining Today', money(qrInfo.remainingToday)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: '#F0FFF4', borderRadius: 10, padding: '8px 10px' }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#7C8491', fontWeight: 700, margin: '0 0 2px' }}>
                      {label}
                    </p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#1565D8', fontWeight: 700, margin: 0 }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {qrList.length > 0 && (
            <form onSubmit={handleSubmitRequest} style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(21,101,216,0.12)' }}>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: '#1565D8', margin: '0 0 14px' }}>
                Create Collect Request
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>VPA</label>
                <select
                  className="form-input no-icon"
                  value={selectedVpa}
                  onChange={(e) => setSelectedVpa(e.target.value)}
                >
                  {qrList.map((q) => (
                    <option key={q.qrId} value={q.vpa}>{q.vpa}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Amount</label>
                <input
                  type="text" inputMode="decimal" className="form-input no-icon" placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>UTR</label>
                <input
                  type="text" className="form-input no-icon" placeholder="e.g. 123456789012"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Remarks</label>
                <input
                  type="text" className="form-input no-icon" placeholder="Optional note" maxLength={200}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>

              {submitError && <p style={fieldErrorStyle}>{submitError}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="signin-btn"
                style={{ background: 'linear-gradient(90deg, #1565D8 0%, #0D4FB0 100%)', boxShadow: '0 4px 22px rgba(21,101,216,0.32)' }}
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};

export default HomePage;
