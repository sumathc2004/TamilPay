import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, CreditCard, Info, Lock, Search, ShieldCheck, Smartphone, X } from 'lucide-react';
import { apiUrl } from '../utils/api';
import { billerLogo } from '../utils/bankLogos';

// Avatar tints, all from the logo: the blues of "Tamil", the orange and amber of "pay".
const AVATAR_TONES = [
  ['#E6EEFB', '#0D4FB0'],
  ['#FEF1E8', '#C24E0C'],
  ['#EAF2FE', '#1565D8'],
  ['#FEF6E4', '#B7791F'],
];

function toneFor(text) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

// "HDFC Credit Card" -> "HD", "SBI Card" -> "SB", "One - BOBCARD Credit Card" -> "BO".
function initials(name) {
  const words = name.replace(/^one\s*-\s*/i, '').split(/\s+/).filter((w) => !/^(bank|credit|card|of|the|ltd|limited|-)$/i.test(w));
  const first = words[0] ?? name;
  return (first.length > 1 && first === first.toUpperCase() ? first.slice(0, 2) : (words[0]?.[0] ?? '') + (words[1]?.[0] ?? first[1] ?? '')).toUpperCase();
}

// Each bank's symbol (the HDFC square, the SBI keyhole) in a circle, as bill-pay apps show
// them. Symbols are square marks, so a circle suits them — unlike the wide wordmarks.
const AVATAR_SIZES = { row: 48, popular: 72, selected: 56, face: 40 };

const BankAvatar = ({ name, logo, variant = 'row' }) => {
  const [failed, setFailed] = useState(false);
  const [bg, fg] = toneFor(name);
  const size = AVATAR_SIZES[variant];
  if (logo && !failed) {
    return (
      <span className={`ccp-avatar ccp-avatar--${variant}`} style={{ width: size, height: size }}>
        <img src={logo} alt="" loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  }
  // No public logo for this bank, or it failed to load: the initials badge instead.
  return (
    <span className={`ccp-avatar ccp-avatar--${variant} ccp-avatar--initials`} style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.32 }}>
      {initials(name)}
    </span>
  );
};

// Each biller names its inputs differently ("Registered Mobile No", "Last 4 Digits of Credit
// Card"…). They are recognised by meaning so every bank gets the same clean form.
function kindOf(param) {
  const name = param.paramName.toLowerCase();
  if (/mobile/.test(name)) return 'mobile';
  if (/last\s*4|4\s*digit/.test(name)) return 'card';
  return 'other';
}

const FIELD_ORDER = { card: 0, mobile: 1, other: 2 };

// ₹2,19,318.80 — Indian grouping, always two decimals.
function rupees(value) {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "2026-10-10" -> "10 Oct 2026". Read as a calendar date, so no time zone can shift the day.
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

// Whole days from today to the due date: negative once it has passed.
function daysUntil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const due = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86400000);
}

// The largest credit card issuers in India, shown first as a one-tap row. Matched by the
// exact billerId from the API, with a short label that fits under a logo.
const POPULAR_BANKS = [
  { id: 'HDFC00000NATW1', label: 'HDFC' },
  { id: 'SBIC00000NATDN', label: 'SBI Card' },
  { id: 'ICIC00000NATSI', label: 'ICICI' },
  { id: 'AXIS00000NATKF', label: 'Axis' },
  { id: 'KOTA00000NATED', label: 'Kotak' },
  { id: 'INDU00000NATL1', label: 'IndusInd' },
  { id: 'IDFC00000NATFQ', label: 'IDFC FIRST' },
  { id: 'RBLB00000NATN3', label: 'RBL' },
];

function fieldsFor(biller) {
  // Spelled as the BBPS service spells it, all lowercase.
  return [...(biller?.customerparams ?? [])]
    .map((param) => ({ ...param, kind: kindOf(param) }))
    .sort((a, b) => FIELD_ORDER[a.kind] - FIELD_ORDER[b.kind]);
}

function clean(field, raw) {
  if (field.kind === 'mobile') {
    // A pasted "+91 98765 43210" or "098765 43210" keeps the number, not the prefix — the
    // +91 is already shown beside the box.
    const digits = raw.replace(/\D/g, '');
    return digits.replace(/^(?:91|0)(?=\d{10}$)/, '').slice(0, 10);
  }
  if (field.kind === 'card') {
    const allowed = field.dataType === 'ALPHANUMERIC' ? /[^A-Za-z0-9]/g : /\D/g;
    return raw.replace(allowed, '').toUpperCase().slice(0, 4);
  }
  return field.dataType === 'NUMERIC' ? raw.replace(/\D/g, '') : raw;
}

function errorFor(field, value) {
  if (!value) return field.optional ? null : 'Required.';
  if (field.kind === 'mobile' && !/^[6-9]\d{9}$/.test(value)) return 'Enter a valid 10-digit mobile number.';
  if (field.kind === 'card' && value.length !== 4) return 'Enter the last 4 digits of the card.';
  return null;
}

/** Credit card bill payment: pick the issuing bank, then enter that bank's card details. */
const CardPaymentsPage = ({ onNavigate, user, onWalletChanged }) => {
  const [billers, setBillers] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [biller, setBiller] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [bill, setBill] = useState(null);
  const [payChoice, setPayChoice] = useState('total');
  const [otherAmount, setOtherAmount] = useState('');
  const [payNotice, setPayNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/bbps/billers?category=credit-card'))
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message ?? body?.detail ?? `Could not load banks (${res.status}).`);
        return body;
      })
      .then(setBillers)
      .catch((err) => setLoadError(err.message));
  }, []);

  // Only issuers the API actually returned, in the order above — a bank dropped upstream
  // simply drops out of the row instead of showing a dead tile.
  const popular = useMemo(
    () => POPULAR_BANKS.map(({ id, label }) => {
      const found = billers?.find((b) => b.billerId === id);
      return found && { ...found, label };
    }).filter(Boolean),
    [billers],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!billers || !needle) return billers ?? [];
    return billers.filter((b) => b.billerName.toLowerCase().includes(needle));
  }, [billers, query]);

  const fields = useMemo(() => fieldsFor(biller), [biller]);
  const cardDigits = values[fields.find((f) => f.kind === 'card')?.paramName] ?? '';

  const choose = (next) => {
    setBiller(next);
    setValues({});
    setErrors({});
    setNotice(null);
    setBill(null);
    setPayNotice(null);
    setConfirming(false);
    setPaid(null);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = Object.fromEntries(fields.map((f) => [f.paramName, errorFor(f, values[f.paramName] ?? '')]).filter(([, msg]) => msg));
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Fetching the bill is the verification: a wrong card/mobile pair comes back as an error
    // from the bank, which is shown as it is.
    setVerifying(true);
    setNotice(null);
    try {
      const res = await fetch(apiUrl('/api/bbps/fetch-bill'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billerId: biller.billerId, values }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ tone: 'error', text: body?.message ?? body?.detail ?? `Could not fetch the bill (${res.status}).` });
        return;
      }
      setBill(body);
      setPayChoice(body.totalDue != null ? 'total' : 'other');
      setOtherAmount('');
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setVerifying(false);
    }
  };

  // The amount to pay, from whichever option is picked, and whether it is allowed.
  const payAmount = !bill ? null
    : payChoice === 'total' ? bill.totalDue
      : payChoice === 'minimum' ? bill.minimumDue
        : (otherAmount === '' ? null : Number(otherAmount));
  const minPay = bill?.minPayable ?? 1;
  const maxPay = bill?.maxPayable ?? null;
  const amountError = payChoice !== 'other' || otherAmount === '' ? null
    : Number.isNaN(payAmount) || payAmount <= 0 ? 'Enter a valid amount.'
      : payAmount < minPay ? `The least you can pay is ${rupees(minPay)}.`
        : maxPay != null && payAmount > maxPay ? `The most you can pay is ${rupees(maxPay)}.`
          : null;
  const canPay = payAmount != null && payAmount > 0 && !amountError;

  // Paying moves real money from the wallet, so the first press only asks to confirm.
  const pay = async () => {
    if (!canPay || paying) return;
    if (!confirming) {
      setConfirming(true);
      setPayNotice(null);
      return;
    }

    setPaying(true);
    setPayNotice(null);
    try {
      const res = await fetch(apiUrl('/api/bbps/pay'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: bill.reference, walletId: user?.walletId ?? 0, amount: payAmount }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setPayNotice(body?.message ?? body?.detail ?? `The payment did not go through (${res.status}).`);
        setConfirming(false);
        return;
      }
      setPaid({ amount: body?.amount ?? payAmount, message: body?.message, reference: body?.reference ?? bill.reference, data: body?.data, at: new Date() });
      onWalletChanged?.(); // the wallet balance in the top bar has changed
    } catch (err) {
      setPayNotice(err.message);
      setConfirming(false);
    } finally {
      setPaying(false);
    }
  };

  const editDetails = () => {
    setBill(null);
    setPayNotice(null);
    setConfirming(false);
    setPaid(null);
    setNotice(null);
  };

  return (
    <div className="ccp-page">
      <section className={`ccp-panel${biller ? ' ccp-panel--form' : ''}`}>
        {/* A plain bar like the bill-pay screens people know: back, title, nothing else. */}
        <header className="ccp-bar">
          <button
            type="button"
            className="ccp-back"
            onClick={() => (biller ? choose(null) : onNavigate?.('home'))}
            aria-label={biller ? 'Back to all banks' : 'Back to home'}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="ccp-title">Credit Card Payment</h1>
        </header>

        {!biller && (
          <>
            <div className="ccp-search">
              <Search size={20} className="ccp-search-icon" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by bank name"
                aria-label="Search by bank name"
                autoComplete="off"
              />
              {query && (
                <button type="button" className="ccp-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Hidden while searching — the search results are the list then. */}
            {!query && popular.length > 0 && (
              <>
                <h2 className="ccp-heading">Popular banks</h2>
                <div className="ccp-popular">
                  {popular.map((b) => (
                    // Logo only; the bank's name is still the button's accessible name and its tooltip.
                    <button key={b.billerId} type="button" className="ccp-popular-item" onClick={() => choose(b)} title={b.billerName} aria-label={b.billerName}>
                      <BankAvatar name={b.billerName} logo={billerLogo(b.billerId)} variant="popular" />
                    </button>
                  ))}
                </div>
              </>
            )}

            <h2 className="ccp-heading">
              {billers && query ? `${visible.length} ${visible.length === 1 ? 'bank' : 'banks'} found` : 'All banks'}
            </h2>

            {!billers && !loadError && (
              <div className="ccp-list" aria-busy="true">
                {Array.from({ length: 9 }, (_, i) => <div key={i} className="ccp-row ccp-row--skeleton" />)}
              </div>
            )}

            {loadError && (
              <div className="cc-notice cc-notice--error">
                <Info size={18} />
                <span>{loadError}</span>
              </div>
            )}

            {billers && visible.length === 0 && (
              <p className="ccp-empty">No bank matches “{query.trim()}”.</p>
            )}

            {billers && visible.length > 0 && (
              <div className="ccp-list">
                {visible.map((b) => (
                  <button key={b.billerId} type="button" className="ccp-row" onClick={() => choose(b)}>
                    <BankAvatar name={b.billerName} logo={billerLogo(b.billerId)} />
                    <span className="ccp-row-name">{b.billerName}</span>
                    <ChevronRight size={18} className="ccp-row-chevron" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {biller && (
          <div className={`ccp-form${bill && !bill.noBillDue ? ' ccp-form--bill' : ''}`}>
            <div className="ccp-selected">
              <BankAvatar name={biller.billerName} logo={billerLogo(biller.billerId)} variant="selected" />
              <div className="ccp-selected-text">
                <p className="ccp-selected-name">{biller.billerName}</p>
                <p className={`ccp-selected-sub${bill && !bill.noBillDue ? ' is-fetched' : ''}`}>
                  {bill && !bill.noBillDue ? <><CheckCircle2 size={14} /> Bill fetched</> : 'Enter the card details to fetch the bill'}
                </p>
              </div>
              <button type="button" className="cc-change" onClick={() => choose(null)}>Change</button>
            </div>

            {!bill && (
            <form onSubmit={submit} noValidate>
              {fields.map((field) => {
                const value = values[field.paramName] ?? '';
                const error = errors[field.paramName];
                return (
                  <label key={field.paramName} className={`cc-field${error ? ' has-error' : ''}`}>
                    <span className="cc-field-label">
                      {field.kind === 'mobile' ? 'Registered mobile number' : field.kind === 'card' ? 'Last 4 digits of card' : field.paramName}
                    </span>
                    <span className="cc-input">
                      {field.kind === 'mobile' && <span className="cc-input-prefix"><Smartphone size={15} /> +91</span>}
                      {field.kind === 'card' && <span className="cc-input-prefix"><CreditCard size={15} /> ••••</span>}
                      <input
                        type="text"
                        inputMode={field.dataType === 'NUMERIC' ? 'numeric' : 'text'}
                        value={value}
                        onChange={(e) => {
                          setValues((v) => ({ ...v, [field.paramName]: clean(field, e.target.value) }));
                          setErrors((errs) => ({ ...errs, [field.paramName]: null }));
                          setNotice(null);
                        }}
                        placeholder={field.kind === 'mobile' ? '10-digit number' : field.kind === 'card' ? 'XXXX' : ''}
                        maxLength={field.kind === 'mobile' ? 10 : field.kind === 'card' ? 4 : undefined}
                        autoComplete="off"
                        className={field.kind === 'card' ? 'cc-input-card' : ''}
                      />
                    </span>
                    {error && <span className="cc-field-error">{error}</span>}
                  </label>
                );
              })}

              {notice && (
                <div className={`cc-notice${notice.tone === 'error' ? ' cc-notice--error' : ''}`} role="alert">
                  <Info size={18} />
                  <span>{notice.text}</span>
                </div>
              )}

              <button type="submit" className="cc-submit" disabled={verifying}>
                {verifying ? 'Fetching your bill…' : 'Verify card'}
              </button>
            </form>
            )}

            {/* The card matched, but this cycle's bill is already paid — good news, not an error. */}
            {bill?.noBillDue && (
              <div className="ccb-clear" role="status">
                <span className="ccb-clear-icon"><CheckCircle2 size={30} strokeWidth={2.2} /></span>
                <p className="ccb-clear-title">No bill due</p>
                <p className="ccb-clear-text">
                  Card •••• {cardDigits} is verified, and there is nothing to pay for the current billing period.
                </p>
                {bill.message && <p className="ccb-clear-bank">The bank says: “{bill.message}”</p>}
                <button type="button" className="cc-submit" onClick={() => choose(null)}>Pay another card</button>
                <button type="button" className="ccb-edit" onClick={editDetails}>Check this card again</button>
              </div>
            )}

            {/* Paid: a receipt in place of the bill. */}
            {paid && (
              <div className="ccr" role="status">
                <span className="ccr-icon"><CheckCircle2 size={34} strokeWidth={2.2} /></span>
                <p className="ccr-title">Payment successful</p>
                <p className="ccr-amount">{rupees(paid.amount)}</p>
                <p className="ccr-sub">paid to {biller.billerName} •••• {cardDigits}</p>
                <dl className="ccr-details">
                  <div><dt>Card holder</dt><dd>{bill?.customerName || '—'}</dd></div>
                  <div><dt>Paid on</dt><dd>{paid.at.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
                  <div><dt>Reference</dt><dd className="ccr-ref">{paid.reference}</dd></div>
                  {paid.message && <div><dt>Status</dt><dd>{paid.message}</dd></div>}
                </dl>
                <p className="ccr-note">The bank may take a short while to show this payment on the card.</p>
                <div className="ccr-actions">
                  <button type="button" className="cc-submit" onClick={() => choose(null)}>Pay another card</button>
                  <button type="button" className="ccb-edit" onClick={() => onNavigate?.('walletSettlement')}>View wallet ledger</button>
                </div>
              </div>
            )}

            {!paid && bill && !bill.noBillDue && (() => {
              const days = daysUntil(bill.dueDate);
              const dueTone = days == null ? '' : days < 0 ? ' is-overdue' : days <= 3 ? ' is-soon' : '';
              const dueText = days == null ? null
                : days < 0 ? `Overdue by ${-days} day${days === -1 ? '' : 's'}`
                  : days === 0 ? 'Due today'
                    : `${days} day${days === 1 ? '' : 's'} left`;
              return (
                <div className="ccb">
                  {/* Left: the bill — a card face to confirm it is the right card, then the facts. */}
                  <div className="ccb-bill">
                    <div className="ccb-face">
                      <div className="ccb-face-top">
                        <span className="ccb-face-bank">{biller.billerName}</span>
                        <BankAvatar name={biller.billerName} logo={billerLogo(biller.billerId)} variant="face" />
                      </div>
                      <span className="ccb-face-chip" aria-hidden="true" />
                      <p className="ccb-face-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;{cardDigits}</p>
                      <div className="ccb-face-bottom">
                        <div>
                          <p className="ccb-face-label">Card holder</p>
                          <p className="ccb-face-value">{bill.customerName || '—'}</p>
                        </div>
                        {bill.dueDate && (
                          <div className="ccb-face-right">
                            <p className="ccb-face-label">Due date</p>
                            <p className="ccb-face-value">{formatDate(bill.dueDate)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <dl className="ccb-facts">
                      {bill.totalDue != null && (
                        <div className="ccb-fact ccb-fact--lead">
                          <dt>Total amount due</dt>
                          <dd>{rupees(bill.totalDue)}</dd>
                        </div>
                      )}
                      {bill.minimumDue != null && (
                        <div className="ccb-fact">
                          <dt>Minimum amount due</dt>
                          <dd>{rupees(bill.minimumDue)}</dd>
                        </div>
                      )}
                      {bill.dueDate && (
                        <div className="ccb-fact">
                          <dt>Due date</dt>
                          <dd>
                            {formatDate(bill.dueDate)}
                            {dueText && <span className={`ccb-chip${dueTone}`}><CalendarClock size={13} /> {dueText}</span>}
                          </dd>
                        </div>
                      )}
                      {bill.billDate && (
                        <div className="ccb-fact">
                          <dt>Statement date</dt>
                          <dd>{formatDate(bill.billDate)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Right: what to pay, and paying it. */}
                  <div className="ccb-pay">
                    <p className="ccb-pay-title">How much do you want to pay?</p>
                    <div className="ccb-options" role="radiogroup" aria-label="Amount to pay">
                      {bill.totalDue != null && (
                        <button type="button" role="radio" aria-checked={payChoice === 'total'}
                          className={`ccb-option${payChoice === 'total' ? ' is-selected' : ''}`} onClick={() => { setPayChoice('total'); setPayNotice(null); setConfirming(false); }}>
                          <span className="ccb-radio" />
                          <span className="ccb-option-text">
                            Total amount due
                            <span className="ccb-option-sub">Clears the full statement</span>
                          </span>
                          <span className="ccb-option-amount">{rupees(bill.totalDue)}</span>
                        </button>
                      )}
                      {bill.minimumDue != null && (
                        <button type="button" role="radio" aria-checked={payChoice === 'minimum'}
                          className={`ccb-option${payChoice === 'minimum' ? ' is-selected' : ''}`} onClick={() => { setPayChoice('minimum'); setPayNotice(null); setConfirming(false); }}>
                          <span className="ccb-radio" />
                          <span className="ccb-option-text">
                            Minimum amount due
                            <span className="ccb-option-sub">Avoids a late fee; interest applies on the rest</span>
                          </span>
                          <span className="ccb-option-amount">{rupees(bill.minimumDue)}</span>
                        </button>
                      )}
                      {/* Built exactly like the two rows above so the radios line up; the amount
                          box sits where their figure does. A div, not a button, because it holds
                          an input — clicks inside the box do not re-select the row. */}
                      <div
                        role="radio" tabIndex={0} aria-checked={payChoice === 'other'}
                        className={`ccb-option${payChoice === 'other' ? ' is-selected' : ''}`}
                        onClick={() => { if (payChoice !== 'other') { setPayChoice('other'); setPayNotice(null); setConfirming(false); } }}
                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setPayChoice('other'); setPayNotice(null); setConfirming(false); } }}
                      >
                        <span className="ccb-radio" />
                        <span className="ccb-option-text">
                          Other amount
                          {maxPay != null && <span className="ccb-option-sub">{rupees(minPay)} – {rupees(maxPay)}</span>}
                        </span>
                        {payChoice === 'other' && (
                          <span className="ccb-other-input" onClick={(e) => e.stopPropagation()}>
                            <span>₹</span>
                            <input
                              type="text" inputMode="decimal" autoFocus value={otherAmount} placeholder="0.00"
                              aria-label="Other amount"
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                setOtherAmount(/^\d*(\.\d{0,2})?$/.test(v) ? v : otherAmount);
                                setPayNotice(null);
                              }}
                            />
                          </span>
                        )}
                      </div>
                    </div>
                    {amountError && <p className="cc-field-error">{amountError}</p>}

                    {/* What this payment does to the statement — the figures a person checks
                        before paying, rather than an empty panel. */}
                    {bill.totalDue != null && (() => {
                      const left = canPay ? bill.totalDue - payAmount : null;
                      return (
                        <dl className="ccb-summary">
                          <div>
                            <dt>Statement amount</dt>
                            <dd>{rupees(bill.totalDue)}</dd>
                          </div>
                          <div>
                            <dt>Paying now</dt>
                            <dd>{canPay ? rupees(payAmount) : '—'}</dd>
                          </div>
                          <div className="ccb-summary-end">
                            <dt>{left != null && left < 0 ? 'Extra paid (as card credit)' : 'Still due after this payment'}</dt>
                            <dd className={left === 0 ? 'is-clear' : ''}>
                              {left == null ? '—' : left === 0 ? `${rupees(0)} · cleared` : rupees(Math.abs(left))}
                            </dd>
                          </div>
                        </dl>
                      );
                    })()}

                    {bill.dueDate && (
                      <p className="ccb-note">
                        <CalendarClock size={14} />
                        Pay before {formatDate(bill.dueDate)} to avoid late payment charges.
                      </p>
                    )}

                    <div className="ccb-total">
                      <span>You pay</span>
                      <strong>{canPay ? rupees(payAmount) : '—'}</strong>
                    </div>

                    {payNotice && (
                      <div className="cc-notice cc-notice--error" role="alert">
                        <Info size={18} />
                        <span>{payNotice}</span>
                      </div>
                    )}

                    {confirming && canPay && (
                      <p className="ccb-confirm">
                        {rupees(payAmount)} will be paid from your TamilPay wallet to {biller.billerName} •••• {cardDigits}.
                      </p>
                    )}

                    <button type="button" className={`cc-submit${confirming ? ' is-confirm' : ''}`} onClick={pay} disabled={!canPay || paying}>
                      {paying ? 'Paying…' : !canPay ? 'Enter an amount' : confirming ? `Confirm and pay ${rupees(payAmount)}` : `Pay ${rupees(payAmount)}`}
                    </button>
                    {confirming && !paying
                      ? <button type="button" className="ccb-edit" onClick={() => setConfirming(false)}>Cancel</button>
                      : <button type="button" className="ccb-edit" onClick={editDetails} disabled={paying}>Edit card details</button>}
                  </div>
                </div>
              );
            })()}

            <p className="cc-secure"><Lock size={13} /> Your card details are only used to fetch this bill.</p>
          </div>
        )}

        <footer className="ccp-footer"><ShieldCheck size={15} /> Secure payments by TamilPay</footer>
      </section>
    </div>
  );
};

export default CardPaymentsPage;
