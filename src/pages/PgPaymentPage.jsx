import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Share2, SlidersHorizontal, X } from 'lucide-react';
import { apiUrl } from '../utils/api';
import { LAST_PG_REF_KEY, stashPaymentReturnSession } from '../utils/pgStatus';
import { MASTER_CLIENT_ID } from '../utils/customer';
import { labelStyle } from '../styles/formStyles';
import Modal from '../components/Modal';

// Customers this retailer has already made links for (name + last four digits only — the
// same two values every report already shows), so the same card needs no retyping. The full
// card number, expiry and CVV are entered on the gateway's own page and never pass through here.
const MAX_SAVED_PAYERS = 8;
const payersKey = (walletId) => `tamilpay_pg_payers_${walletId}`;
const loadPayers = (walletId) => {
  try {
    const list = JSON.parse(localStorage.getItem(payersKey(walletId)) || '[]');
    return Array.isArray(list) ? list.filter((p) => p?.name && /^\d{4}$/.test(p.card)) : [];
  } catch {
    return [];
  }
};
const savePayer = (walletId, name, card) => {
  try {
    const rest = loadPayers(walletId).filter((p) => !(p.name.toLowerCase() === name.toLowerCase() && p.card === card));
    localStorage.setItem(payersKey(walletId), JSON.stringify([{ name, card }, ...rest].slice(0, MAX_SAVED_PAYERS)));
  } catch { /* storage unavailable — the form just isn't prefilled next time */ }
};

const sectionLabelStyle = {
  fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '1px',
  textTransform: 'uppercase', color: '#7C8491', margin: '0 0 10px',
};

/** Overlapping "folder tab" strip — see .tab-strip in index.css for the shape. */
const TabStrip = ({ items, activeId, idKey, labelKey, onSelect }) => (
  <div className="tab-strip" style={{ overflowX: 'auto' }}>
    {items.map((item, i) => (
      <button
        key={item[idKey]}
        type="button"
        className={`tab-strip-item${activeId === item[idKey] ? ' tab-strip-item--active' : ''}`}
        onClick={() => onSelect(item[idKey])}
        style={{ zIndex: activeId === item[idKey] ? items.length + 10 : items.length - i }}
      >
        <span className="tab-strip-shape">
          <span className="tab-strip-content">{item[labelKey]}</span>
        </span>
      </button>
    ))}
  </div>
);

// Home → Pay In → PG. Sidebar menu shell (same look as Admin > PG Settings) lists
// Groups down the left; picking one reveals Settlement → Category → PG on the right,
// all progressively revealed on this one page — matches PgSettings/Pg/SelectByWallet's
// flat one-row-per-Group×Settlement×PG shape, which we group client-side as the user drills in.
const PgPaymentPage = ({ onNavigate, user }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [settlementName, setSettlementName] = useState(null);
  const [selectedPg, setSelectedPg] = useState(null);
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [linkResult, setLinkResult] = useState(null);
  const [payers, setPayers] = useState([]);

  // The login response's walletId is 0 for most accounts — the customer record upstream
  // simply doesn't carry it. The wallet's real id only comes from Wallet/SelectByCustomerId,
  // so resolve it here rather than trusting the session copy; without this the fetch below
  // never fired and the page sat on its loading state forever.
  const [walletId, setWalletId] = useState(user?.walletId || null);

  useEffect(() => {
    if (user?.walletId || !user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}/wallet`))
      .then((res) => (res.ok ? res.json() : null))
      .then((wallet) => {
        if (wallet?.Id) setWalletId(wallet.Id);
        else setError('No wallet is linked to this account yet.');
      })
      .catch((err) => setError(err.message));
  }, [user?.id, user?.walletId]);

  useEffect(() => {
    if (!walletId) return;
    setRows(null);
    setError(null);
    fetch(apiUrl(`/api/pg/by-wallet?clientId=${MASTER_CLIENT_ID}&walletId=${walletId}`))
      .then(async (res) => {
        if (!res.ok) {
          const problem = await res.json().catch(() => null);
          throw new Error(problem?.detail ?? problem?.message ?? `Request failed (${res.status}).`);
        }
        return res.json();
      })
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [walletId]);

  useEffect(() => {
    if (walletId) setPayers(loadPayers(walletId));
  }, [walletId]);

  const fillPayer = (payer) => {
    setCustomerName(payer.name);
    setCardNumber(payer.card);
    setLinkError(null);
  };

  // Typing a name that was used before brings its card along, if the card box is still empty.
  const handleNameChange = (value) => {
    setCustomerName(value);
    const match = payers.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (match && cardNumber === '') setCardNumber(match.card);
  };

  const uniqueBy = (list, key) => Array.from(new Map(list.map((r) => [r[key], r])).values());

  const groups = rows ? uniqueBy(rows, 'groupId') : [];
  const groupRows = rows?.filter((r) => r.groupId === groupId) ?? [];
  // Grouped by settlement NAME, not settlementId — the same settlement type (e.g.
  // "T+0 Instant") gets a distinct settlementId per PG it's configured on, but it
  // should still read as one tab, showing every PG under it together.
  const settlements = uniqueBy(groupRows, 'settlementName');
  const settlementRows = groupRows.filter((r) => r.settlementName === settlementName);

  // Default to the first group once the data's in, and the first settlement once a
  // group is picked — the user shouldn't have to click through the obvious defaults.
  useEffect(() => {
    if (groups.length > 0 && groupId === null) setGroupId(groups[0].groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    if (settlements.length > 0 && settlementName === null) setSettlementName(settlements[0].settlementName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, rows]);

  const selectGroup = (id) => {
    setGroupId(id);
    setSettlementName(null);
    setSelectedPg(null);
  };

  const selectSettlement = (name) => {
    setSettlementName(name);
    setSelectedPg(null);
  };

  const selectPg = (pg) => {
    setSelectedPg(pg);
    setAmount('');
    setCustomerName('');
    setCardNumber('');
    setLinkError(null);
    setLinkResult(null);
  };

  // MaxLimit is genuinely optional upstream — null means "no cap configured", not zero.
  // Read as a number it became 0, which rejected every keystroke and made the field
  // impossible to type in, so null is treated as unlimited.
  const maxLimitOf = (pg) => (pg?.maxLimit == null ? null : Number(pg.maxLimit));
  const maxLimit = maxLimitOf(selectedPg);
  const maxLimitText = maxLimit == null ? 'No limit' : `₹${maxLimit.toFixed(2)}`;

  // Only lets the amount field hold a number within the PG's max limit — a keystroke
  // that would push it over is simply rejected rather than clamped, so typing "50" then
  // another "0" when the max is 300 just doesn't register that last digit.
  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    if (raw === '') {
      setAmount('');
      return;
    }
    const value = Number(raw);
    if (!Number.isNaN(value) && selectedPg && (maxLimit == null || value <= maxLimit)) {
      setAmount(raw);
    }
  };

  const formatCharge = (row) => {
    if (row.chargeValue == null) return '—';
    return row.chargeType === 'PERCENT' ? `${row.chargeValue}%` : `₹${Number(row.chargeValue).toFixed(2)}`;
  };

  // The gateway's redirect may not carry the reference back, so the status page falls
  // back to the last one generated in this browser.
  const rememberReference = (link) => {
    stashPaymentReturnSession(user);
    const ref = link?.refNo || new URL(link?.pgLink || 'http://x/').searchParams.get('referenceNumber');
    if (!ref) return;
    try { localStorage.setItem(LAST_PG_REF_KEY, ref); } catch { /* storage unavailable */ }
  };

  const handleGenerateLink = async () => {
    if (!selectedPg) return;
    const amountValue = Number(amount);
    if (!amount || Number.isNaN(amountValue) || amountValue <= 0) {
      setLinkError(maxLimit == null ? 'Enter an amount.' : `Enter an amount up to ₹${maxLimit.toFixed(2)}.`);
      return;
    }
    if (!customerName.trim()) {
      setLinkError('Enter the customer name.');
      return;
    }
    if (cardNumber.length !== 4) {
      setLinkError('Enter the last 4 digits of the card.');
      return;
    }

    setLinkSubmitting(true);
    setLinkError(null);
    setLinkResult(null);
    try {
      const res = await fetch(apiUrl('/api/pg/generate-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: MASTER_CLIENT_ID,
          walletId,
          pgCode: selectedPg.pgKey,
          customerName: customerName.trim(),
          cardLast4: cardNumber,
          amount: amountValue,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setLinkResult(created);
        rememberReference(created);
        savePayer(walletId, customerName.trim(), cardNumber);
        setPayers(loadPayers(walletId));
      } else {
        const problem = await res.json().catch(() => null);
        setLinkError(problem?.detail ?? problem?.message ?? `Failed to generate link (${res.status}).`);
      }
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!linkResult) return;
    navigator.clipboard.writeText(linkResult.pgLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleShareLink = () => {
    if (!linkResult) return;
    if (navigator.canShare?.({ url: linkResult.pgLink }) || navigator.share) {
      navigator.share({ title: 'TamilPay Payment Link', url: linkResult.pgLink }).catch(() => {
        // Share cancelled — nothing to do.
      });
    } else {
      handleCopyLink();
    }
  };

  const handleBrowseLink = () => {
    if (!linkResult) return;
    window.open(linkResult.pgLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="theme-green" style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(var(--theme-accent-rgb),0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* No padding/gap here — the sidebar sits flush against the navbar and the left
          edge, matching the Admin > PG Settings sidebar shell. */}
      <div className="sidebar-shell-row" style={{ position: 'relative', zIndex: 2, minHeight: 'calc(100vh - 64px)' }}>
        {/* Sidebar menu — Groups, sticky under the navbar */}
        <div
          className="sidebar-shell-sidebar"
          style={{
            background: 'var(--theme-heading)',
            padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4,
            position: 'sticky', top: 64, alignSelf: 'flex-start',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15, color: '#ffffff',
              margin: '4px 0 12px', padding: '0 4px',
            }}
          >
            PG
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '0 0 8px' }} />

          {groups.map((g) => (
            <button
              key={g.groupId}
              type="button"
              onClick={() => selectGroup(g.groupId)}
              className={groupId === g.groupId ? 'sidebar-menu-item sidebar-menu-item--active' : 'sidebar-menu-item'}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12,
                border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5,
              }}
            >
              <SlidersHorizontal size={17} />
              {g.groupName}
            </button>
          ))}

          <div style={{ flex: 1, minHeight: 12 }} />
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '4px 0 8px' }} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onNavigate?.('home')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12,
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5,
            }}
          >
            <ArrowLeft size={17} />
            Back to Home
          </button>
        </div>

        {/* Content area keeps its own padding, separate from the flush sidebar — split
            50/50 between the PG list and the payment form that appears once one is picked */}
        <div className="pg-split-row" style={{ flex: 1, padding: '20px clamp(16px, 4vw, 40px)', minWidth: 0, gap: 28 }}>
          <div style={{ flex: '1 1 50%', minWidth: 0 }}>
            {!rows && !error && (
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>
            )}
            {error && (
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load PGs: {error}</p>
            )}
            {rows && rows.length === 0 && !error && (
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No payment gateways are set up for your wallet yet.</p>
            )}
            {rows && rows.length > 0 && !groupId && (
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Pick a group from the left to see its settlements and categories.</p>
            )}

            {groupId && (
              <>
                {/* Settlement — horizontal row */}
                <p style={sectionLabelStyle}>Settlement</p>
                <div style={{ marginBottom: 24 }}>
                  <TabStrip items={settlements} activeId={settlementName} idKey="settlementName" labelKey="settlementName" onSelect={selectSettlement} />
                </div>

                {/* Category — appears once a settlement is picked; flat list of PGs, name
                    first with category/limit/charge as a small subtitle underneath */}
                {settlementName && (
                  <>
                    <p style={sectionLabelStyle}>Category</p>
                    <div style={{ border: '1px solid rgba(var(--theme-heading-rgb),0.08)', borderRadius: 14, background: '#F3F7FD', overflow: 'hidden' }}>
                      {settlementRows.map((pg, i) => (
                        <div
                          key={pg.pgId}
                          style={{
                            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
                            background: selectedPg?.pgId === pg.pgId ? 'var(--theme-tint)' : 'transparent',
                            borderTop: i > 0 ? '1px solid rgba(var(--theme-heading-rgb),0.06)' : 'none',
                            padding: '12px 16px',
                          }}
                        >
                          <div style={{ flex: '2 1 110px', minWidth: 0 }}>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--theme-heading)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {pg.pgName}
                            </p>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#7C8491', margin: '2px 0 0' }}>
                              {pg.categoryName}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700, margin: '0 0 2px' }}>
                              Max
                            </p>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: 'var(--theme-heading)', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                              {maxLimitOf(pg) == null ? "No limit" : `₹${maxLimitOf(pg).toFixed(2)}`}
                            </p>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700, margin: '0 0 2px' }}>
                              %
                            </p>
                            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: 'var(--theme-heading)', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                              {formatCharge(pg)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => selectPg(pg)}
                            style={{
                              flexShrink: 0, background: 'var(--theme-accent)', border: 'none', borderRadius: 7, color: '#ffffff',
                              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11.5, padding: '6px 12px', cursor: 'pointer',
                            }}
                          >
                            Select
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right half — payment details for whichever PG was Selected on the left.
              Submit behavior isn't decided yet, so this is just the fields for now. */}
          <div style={{ flex: '1 1 50%', minWidth: 0 }}>
            {selectedPg ? (
              <div style={{ background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.08)', borderRadius: 14, padding: '20px 22px' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--theme-heading)', margin: '0 0 3px' }}>
                  {selectedPg.pgName}
                </p>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#7C8491', margin: '0 0 20px' }}>
                  {selectedPg.categoryName} · Max {maxLimitText} · {formatCharge(selectedPg)}
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Amount</label>
                  <input
                    className="form-input no-icon"
                    type="text" inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder={maxLimit == null ? 'Enter amount' : `Up to ₹${maxLimit.toFixed(2)}`}
                  />
                </div>

                {payers.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Paying with the same card as before?</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {payers.map((p) => {
                        const active = customerName === p.name && cardNumber === p.card;
                        return (
                          <button
                            key={`${p.name}-${p.card}`}
                            type="button"
                            onClick={() => fillPayer(p)}
                            style={{
                              border: `1px solid ${active ? 'var(--theme-accent)' : 'rgba(var(--theme-heading-rgb),0.2)'}`,
                              background: active ? 'var(--theme-tint)' : '#ffffff', color: 'var(--theme-heading)',
                              borderRadius: 999, padding: '6px 12px', fontFamily: 'Inter, sans-serif',
                              fontWeight: 600, fontSize: 12, cursor: 'pointer',
                            }}
                          >
                            {p.name} · •••• {p.card}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: '#7C8491', margin: '6px 0 0' }}>
                      Pick one to fill the name and card, or type a different customer below.
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Customer Name</label>
                  <input
                    className="form-input no-icon"
                    value={customerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Rohan Kumar"
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Card Number (Last Four Digit)</label>
                  <input
                    className="form-input no-icon"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="e.g. 1111"
                  />
                </div>

                {linkError && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#E53E3E', margin: '0 0 12px' }}>
                    {linkError}
                  </p>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGenerateLink}
                  disabled={linkSubmitting}
                  style={{
                    width: '100%', background: 'var(--theme-accent)', border: 'none', borderRadius: 10, color: '#ffffff',
                    fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13.5, padding: '12px 0',
                    cursor: linkSubmitting ? 'default' : 'pointer', opacity: linkSubmitting ? 0.7 : 1,
                  }}
                >
                  {linkSubmitting ? 'Generating…' : 'Generate Link'}
                </button>

              </div>
            ) : null}
          </div>
        </div>
      </div>

      {linkResult && (
        <Modal onClose={() => setLinkResult(null)} themeClassName="theme-green" style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 420, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--theme-heading)', margin: 0 }}>
              Link generated
            </p>
            <button
              type="button"
              className="icon-btn-anim"
              onClick={() => setLinkResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
            >
              <X size={18} color="#7C8491" />
            </button>
          </div>

          <div style={{ background: 'var(--theme-tint)', border: '1px solid rgba(var(--theme-accent-rgb),0.2)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px 16px', marginBottom: 12 }}>
              {[
                ['Ref No.', linkResult.refNo],
                ['Amount', `₹${Number(linkResult.amount).toFixed(2)}`],
                ['Charges', `₹${Number(linkResult.charges).toFixed(2)}`],
                ['Credit to Bank', `₹${(Number(linkResult.amount) - Number(linkResult.charges)).toFixed(2)}`],
                ['Status', linkResult.status],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700, margin: '0 0 2px' }}>
                    {label}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: 'var(--theme-heading)', fontWeight: 600, margin: 0 }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <a
              href={linkResult.pgLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', wordBreak: 'break-all', fontFamily: 'Inter, sans-serif', fontSize: 12.5,
                fontWeight: 600, color: 'var(--theme-heading)', textDecoration: 'underline',
              }}
            >
              {linkResult.pgLink}
            </a>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={handleCopyLink}
              className="signin-btn"
              style={{ flex: 1, padding: '0 14px', height: 38, fontSize: 13 }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleShareLink}
              className="signin-btn"
              style={{ flex: 1, padding: '0 14px', height: 38, fontSize: 13 }}
            >
              <Share2 size={15} /> Share
            </button>
            <button
              type="button"
              onClick={handleBrowseLink}
              className="signin-btn"
              style={{ flex: 1, padding: '0 14px', height: 38, fontSize: 13 }}
            >
              <ExternalLink size={15} /> Browse
            </button>
          </div>
          <a
            href={`/pg-status?reference_id=${encodeURIComponent(linkResult.refNo || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center', marginTop: 12, fontFamily: 'Inter, sans-serif',
              fontSize: 13, fontWeight: 600, color: 'var(--theme-heading)', textDecoration: 'underline',
            }}
          >
            Check payment status
          </a>
        </Modal>
      )}
    </div>
  );
};

export default PgPaymentPage;
