import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, ChevronRight, Download, Landmark, Plus, Receipt, RefreshCw, Search, Share2, Users, X,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { labelStyle, fieldErrorStyle } from '../styles/formStyles';
import { apiUrl } from '../utils/api';
import { MASTER_CLIENT_ID } from '../utils/customer';
import { loadImageAsDataUrl } from '../utils/pdf';
import Modal from '../components/Modal';
import BankCombobox from '../components/BankCombobox';
import tamilPayLogo from '../assets/images/tamilpay-logo.png';

const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^\d{9,18}$/;

const EMPTY_FORM = { senderName: '', senderAddress: '', senderPan: '', senderAadhaar: '' };
const EMPTY_BANK_FORM = { accountHolderName: '', accountNumber: '', ifsc: '', bankName: '' };
const EMPTY_TRANSFER_FORM = { amount: '', pin: '' };

const Field = ({ label, error, children, style }) => (
  <div style={{ marginBottom: 16, ...style }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {error && <p style={fieldErrorStyle}>{error}</p>}
  </div>
);

// Shared card used everywhere a bank account is displayed — the beneficiary
// list, a single sender's own account, and a beneficiary's detail view — so
// every bank account, present or future, renders identically.
const BankAccountCard = ({ account, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      background: '#ffffff', border: '1px solid rgba(var(--theme-heading-rgb),0.08)', borderRadius: 14,
      cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.2s, transform 0.2s',
      minWidth: 0,
    }}
  >
    <div
      style={{
        width: 42, height: 42, borderRadius: '50%', background: '#F3F7FD',
        border: '1px solid rgba(var(--theme-heading-rgb),0.08)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}
    >
      {account.BankLogoUrl ? (
        <img src={account.BankLogoUrl} alt={account.BankName} style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
      ) : (
        <Landmark size={18} color="var(--theme-heading)" />
      )}
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--theme-heading)', margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {account.AccountHolderName}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: 0 }}>
          {account.BankName}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 2, flexWrap: 'wrap' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: 0 }}>
          {account.AccountNumber}
        </p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: 0 }}>
          IFSC: {account.IFSC}
        </p>
      </div>
    </div>

    {onClick && <ChevronRight size={18} color="#B0B8C4" style={{ flexShrink: 0 }} />}
  </div>
);

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.08)',
  padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
  maxWidth: 480,
  width: '100%',
};

const receiptBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.1)', borderRadius: 8,
  cursor: 'pointer', color: 'var(--theme-heading)', fontFamily: 'Inter, sans-serif', fontWeight: 600,
  fontSize: 12.5, padding: '7px 12px',
};

/**
 * IMPS flow: enter a mobile number, verify it against the remote sender
 * records, then either view the matched sender or register a new one
 * (sender/Insert has no matching update/delete, so registration only
 * ever runs once per mobile number).
 */
const ImpsPage = ({ onNavigate, user, onWalletChanged }) => {
  const [step, setStep] = useState('input'); // 'input' | 'verified' | 'register'
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileError, setMobileError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [sender, setSender] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // A sender can have more than one bank account — every account the API returns is kept.
  const [bankAccounts, setBankAccounts] = useState([]);
  // The Transfer panel only appears once a specific account card is clicked.
  const [transferAccount, setTransferAccount] = useState(null);
  const [showBankForm, setShowBankForm] = useState(false);
  // Where Cancel should return to — the screen the form was actually opened from.
  const [bankFormReturnStep, setBankFormReturnStep] = useState('verified');
  const [bankForm, setBankForm] = useState(EMPTY_BANK_FORM);
  const [bankFieldErrors, setBankFieldErrors] = useState({});
  const [bankFormError, setBankFormError] = useState(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER_FORM);
  const [transferFieldErrors, setTransferFieldErrors] = useState({});
  const [transferFormError, setTransferFormError] = useState(null);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const [banks, setBanks] = useState([]);
  // The live wallet balance — refreshed on load and after every transfer, since the
  // login response's lastBalance is only a snapshot from whenever the user signed in.
  const [walletBalance, setWalletBalance] = useState(null);
  const [storeDetails, setStoreDetails] = useState(null);
  const [todayTransactions, setTodayTransactions] = useState([]);
  const [todayTransactionsLoading, setTodayTransactionsLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/banks'))
      .then((res) => (res.ok ? res.json() : []))
      .then(setBanks)
      .catch(() => setBanks([]));
  }, []);

  const refreshWalletBalance = useCallback(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}/wallet`))
      .then((res) => (res.ok ? res.json() : null))
      .then((wallet) => setWalletBalance(wallet?.currentBalance ?? null))
      .catch(() => setWalletBalance(null));
  }, [user]);

  useEffect(() => {
    refreshWalletBalance();
  }, [refreshWalletBalance]);

  const fetchTodayTransactions = useCallback(() => {
    if (!user?.walletId) return;
    fetch(apiUrl(`/api/transactions/today?walletId=${user.walletId}`))
      .then((res) => (res.ok ? res.json() : []))
      .then(setTodayTransactions)
      .catch(() => setTodayTransactions([]))
      .finally(() => setTodayTransactionsLoading(false));
  }, [user]);
  // Only the manual refresh button re-arms the spin animation — the initial mount
  // fetch relies on the loading state already starting true, so effects never need
  // to set it synchronously themselves.
  const refreshTodayTransactions = useCallback(() => {
    setTodayTransactionsLoading(true);
    fetchTodayTransactions();
  }, [fetchTodayTransactions]);
  // Without a walletId there's nothing to fetch, so the loading state (which starts
  // true for the normal case) should never apply — derived here instead of forcing
  // an extra synchronous setState from inside the effect for that branch.
  const isLoadingTodayTransactions = todayTransactionsLoading && Boolean(user?.walletId);

  useEffect(() => {
    fetchTodayTransactions();
  }, [fetchTodayTransactions]);

  // The login response doesn't carry STORE_ADDRESS, so the full customer record is
  // fetched once for the receipt header (store name, address, contact number).
  useEffect(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}`))
      .then((res) => (res.ok ? res.json() : null))
      .then(setStoreDetails)
      .catch(() => setStoreDetails(null));
  }, [user]);

  const updateField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));
  const updateBankField = (name) => (e) => setBankForm((f) => ({ ...f, [name]: e.target.value }));
  const updateTransferField = (name) => (e) => setTransferForm((f) => ({ ...f, [name]: e.target.value }));

  const selectedBank = banks.find((b) => b.BankName === bankForm.bankName);

  // Informational only — the amount entered times the logged-in user's own payout
  // charge rate (from the wallet/Login response), shown live as they type.
  const payoutChargeAmount = Number(transferForm.amount || 0) * Number(user?.payoutCharges ?? 0);

  const checkBankAccount = async (mobile) => {
    setTransferAccount(null);
    setTransferForm(EMPTY_TRANSFER_FORM);
    setTransferFieldErrors({});
    setTransferFormError(null);
    setTransferSuccess(false);
    setReceipt(null);
    setShowReceipt(false);
    try {
      const res = await fetch(apiUrl(`/api/bankaccounts?clientId=${MASTER_CLIENT_ID}&mobileNumber=${mobile}`));
      setBankAccounts(res.ok ? await res.json() : []);
    } catch {
      setBankAccounts([]);
    }
  };

  const openBeneficiaryList = async () => {
    setStep('beneficiary');
    setBeneficiarySearch('');
    setBeneficiariesLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/bankaccounts/list?clientId=${MASTER_CLIENT_ID}`));
      setBeneficiaries(res.ok ? await res.json() : []);
    } catch {
      setBeneficiaries([]);
    } finally {
      setBeneficiariesLoading(false);
    }
  };

  // The sender's own bank accounts, narrowed by the search box: holder name, account number
  // (spaces ignored), bank name or IFSC.
  const filteredBankAccounts = (() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return bankAccounts;
    const digits = q.replace(/\s+/g, '');
    return bankAccounts.filter((a) =>
      [a.AccountHolderName, a.BankName, a.IFSC].some((v) => String(v ?? '').toLowerCase().includes(q))
      || String(a.AccountNumber ?? '').replace(/\s+/g, '').includes(digits));
  })();

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const q = beneficiarySearch.trim().toLowerCase();
    if (!q) return true;
    return b.AccountHolderName?.toLowerCase().includes(q) || b.AccountNumber?.includes(q);
  });

  const handleVerify = async (e) => {
    e.preventDefault();
    setMobileError(null);

    if (!INDIAN_MOBILE_PATTERN.test(mobileNumber)) {
      setMobileError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(apiUrl(`/api/senders?clientId=${MASTER_CLIENT_ID}&mobileNumber=${mobileNumber}`));
      if (res.ok) {
        setSender(await res.json());
        checkBankAccount(mobileNumber);
        setStep('verified');
      } else if (res.status === 404) {
        setForm(EMPTY_FORM);
        setFieldErrors({});
        setFormError(null);
        setStep('register');
      } else {
        setMobileError(`Could not verify this number (${res.status}).`);
      }
    } catch (err) {
      setMobileError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.senderName.trim()) errors.senderName = 'Sender name is required.';

    return errors;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      const res = await fetch(apiUrl('/api/senders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: MASTER_CLIENT_ID,
          mobileNumber,
          senderName: form.senderName.trim(),
        }),
      });

      if (res.ok) {
        setSender(await res.json());
        checkBankAccount(mobileNumber);
        setStep('verified');
        return;
      }

      if (res.status === 400) {
        const problem = await res.json();
        const errs = {};
        for (const [key, messages] of Object.entries(problem.errors ?? {})) {
          errs[key.charAt(0).toLowerCase() + key.slice(1)] = messages.join(' ');
        }
        setFieldErrors(errs);
        setFormError('Please fix the highlighted fields.');
      } else {
        setFormError(`Registration failed (${res.status}).`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const validateBank = () => {
    const errors = {};
    if (!bankForm.accountHolderName.trim()) errors.accountHolderName = 'Account holder name is required.';
    if (!ACCOUNT_NUMBER_PATTERN.test(bankForm.accountNumber.trim())) errors.accountNumber = 'Enter a valid account number.';
    if (!IFSC_PATTERN.test(bankForm.ifsc.trim().toUpperCase())) errors.ifsc = 'Enter a valid IFSC code, e.g. SBIN0013351.';
    if (!bankForm.bankName.trim()) errors.bankName = 'Bank name is required.';
    return errors;
  };

  const handleVerifyAccount = async () => {
    setVerifyError(null);

    if (!bankForm.bankName.trim()) {
      setVerifyError('Select a bank first.');
      return;
    }
    if (!ACCOUNT_NUMBER_PATTERN.test(bankForm.accountNumber.trim())) {
      setVerifyError('Enter a valid account number first.');
      return;
    }
    if (!IFSC_PATTERN.test(bankForm.ifsc.trim().toUpperCase())) {
      setVerifyError('Select a bank to fill in the IFSC code first.');
      return;
    }

    setVerifyingAccount(true);
    try {
      const res = await fetch(apiUrl('/api/bankaccounts/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: user?.walletId, accountNumber: bankForm.accountNumber, ifsc: bankForm.ifsc.toUpperCase() }),
      });

      if (res.ok) {
        const data = await res.json();
        setBankForm((f) => ({ ...f, accountHolderName: data.AccountVarifiedname ?? f.accountHolderName }));
        setBankFieldErrors((errs) => ({ ...errs, accountHolderName: undefined }));
      } else {
        const problem = await res.json().catch(() => null);
        setVerifyError(problem?.message || 'Could not verify this account.');
      }
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleAddBankAccount = async (e) => {
    e.preventDefault();
    setBankFormError(null);

    const errors = validateBank();
    if (Object.keys(errors).length > 0) {
      setBankFieldErrors(errors);
      setBankFormError('Please fix the highlighted fields.');
      return;
    }

    setBankSubmitting(true);
    setBankFieldErrors({});

    try {
      const res = await fetch(apiUrl('/api/bankaccounts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: MASTER_CLIENT_ID,
          mobileNumber,
          accountHolderName: bankForm.accountHolderName.trim(),
          accountNumber: bankForm.accountNumber.trim(),
          ifsc: bankForm.ifsc.trim().toUpperCase(),
          bankName: bankForm.bankName.trim(),
        }),
      });

      if (res.ok) {
        setBankAccounts(await res.json());
        setTransferAccount(null);
        setShowBankForm(false);
        if (bankFormReturnStep === 'beneficiary') {
          openBeneficiaryList();
        } else {
          setStep(bankFormReturnStep);
        }
        return;
      }

      if (res.status === 400) {
        const problem = await res.json();
        const errs = {};
        for (const [key, messages] of Object.entries(problem.errors ?? {})) {
          errs[key.charAt(0).toLowerCase() + key.slice(1)] = messages.join(' ');
        }
        setBankFieldErrors(errs);
        setBankFormError('Please fix the highlighted fields.');
      } else {
        setBankFormError(`Could not add bank account (${res.status}).`);
      }
    } catch (err) {
      setBankFormError(err.message);
    } finally {
      setBankSubmitting(false);
    }
  };

  const MAX_TRANSFER_AMOUNT = 100000;

  const handleAmountChange = (e) => {
    const digits = e.target.value.replace(/[^0-9.]/g, '');
    const amount = Number(digits);
    if (!Number.isNaN(amount) && amount > MAX_TRANSFER_AMOUNT) return;
    setTransferForm((f) => ({ ...f, amount: digits }));
  };

  const validateTransfer = () => {
    const errors = {};
    const amount = Number(transferForm.amount);
    if (!transferForm.amount || Number.isNaN(amount) || amount <= 0) {
      errors.amount = 'Enter a valid amount.';
    } else if (amount > MAX_TRANSFER_AMOUNT) {
      errors.amount = `Amount cannot exceed ₹${MAX_TRANSFER_AMOUNT.toLocaleString('en-IN')}.`;
    } else if (walletBalance !== null && amount > walletBalance) {
      errors.amount = 'Insufficient balance.';
    }
    if (!/^\d{4,6}$/.test(transferForm.pin)) {
      errors.pin = 'Enter your 4-6 digit PIN.';
    }
    setTransferFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setTransferFormError(null);
    setTransferSuccess(false);
    if (!validateTransfer()) return;

    const targetAccount = transferAccount ?? selectedBeneficiary;
    setTransferSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user?.id,
          senderId: sender?.id,
          bankAccountId: targetAccount?.id,
          amount: Number(transferForm.amount),
          pin: transferForm.pin,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setReceipt({
          transactionId: data.transactionId,
          dateTime: new Date().toLocaleString(),
          senderName: sender?.SenderName,
          senderMobile: sender?.mobileNumber,
          accountHolderName: targetAccount?.AccountHolderName,
          accountNumber: targetAccount?.AccountNumber,
          ifsc: targetAccount?.IFSC,
          bankName: targetAccount?.BankName,
          bankLogoUrl: targetAccount?.BankLogoUrl,
          amount: Number(transferForm.amount),
        });
        setShowReceipt(true);
        setTransferSuccess(true);
        setTransferForm(EMPTY_TRANSFER_FORM);
        refreshWalletBalance();
        refreshTodayTransactions();
        onWalletChanged?.();
      } else {
        const problem = await res.json().catch(() => null);
        setTransferFormError(problem?.message ?? problem?.detail ?? `Transfer failed (${res.status}).`);
      }
    } catch (err) {
      setTransferFormError(err.message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Builds the receipt PDF and returns the jsPDF document without saving it —
  // shared by the Download button (saves it) and the Share button (shares the bytes).
  const buildReceiptPdf = async (receiptData) => {
    const [logoDataUrl, bankLogoDataUrl] = await Promise.all([
      loadImageAsDataUrl(tamilPayLogo),
      receiptData.bankLogoUrl ? loadImageAsDataUrl(receiptData.bankLogoUrl) : null,
    ]);

    const storeName = storeDetails?.STORE_NAME ?? user?.STORE_NAME ?? '';
    const storeAddress = storeDetails?.STORE_ADDRESS ?? '';
    const contact = storeDetails?.MOBILE_NUMBER ?? user?.MOBILE_NUMBER ?? '';

    const detailRows = [
      ['Transaction ID', String(receiptData.transactionId ?? '—')],
      ['Date', receiptData.dateTime],
      ['Sender', `${receiptData.senderName} (${receiptData.senderMobile})`],
      ['Beneficiary', receiptData.accountHolderName],
      ['Account Number', receiptData.accountNumber],
      ['IFSC', receiptData.ifsc],
      ['Bank', receiptData.bankName],
      ['Amount', `Rs. ${receiptData.amount.toFixed(2)}`],
      ['UTR', receiptData.utr || String(receiptData.transactionId ?? '—')],
    ];

    const boxLeft = 40;
    const boxRight = 555;
    const pad = 24;
    const left = boxLeft + pad;
    const right = boxRight - pad;
    const boxTop = 36;
    // jsPDF's built-in fonts don't include the ₹ glyph, so "Rs." is used throughout.
    const boxBottom = boxTop + 280 + detailRows.length * 22;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    doc.setDrawColor(220, 224, 232);
    doc.setLineWidth(1);
    doc.roundedRect(boxLeft, boxTop, boxRight - boxLeft, boxBottom - boxTop, 10, 10);

    let y = boxTop + 34;
    const textLeft = logoDataUrl ? left + 72 : left;

    if (logoDataUrl) {
      const { width: naturalW, height: naturalH } = doc.getImageProperties(logoDataUrl);
      const logoScale = Math.min(64 / naturalW, 24 / naturalH);
      doc.addImage(logoDataUrl, 'PNG', left, y - 22, naturalW * logoScale, naturalH * logoScale);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(16, 42, 80);
    doc.text(storeName, textLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(124, 132, 145);
    doc.text(storeAddress, textLeft, y + 15);
    doc.text(contact, textLeft, y + 28);

    y += 50;
    doc.setDrawColor(220, 224, 232);
    doc.line(left, y, right, y);
    y += 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(16, 42, 80);
    doc.text('Transfer Receipt', (left + right) / 2, y, { align: 'center' });
    y += 16;

    doc.setDrawColor(220, 224, 232);
    doc.line(left, y, right, y);
    y += 30;

    const valueColumn = left + 140;
    for (const [label, value] of detailRows) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(156, 163, 175);
      doc.text(label, left, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 42, 80);
      doc.text(value, valueColumn, y);
      y += 22;
    }

    y += 10;
    doc.setDrawColor(220, 224, 232);
    doc.line(left, y, right, y);
    y += 30;

    // Status pill, with the bank's logo alongside it.
    const status = (receiptData.status || 'SUCCESS').toUpperCase();
    const isSuccess = status === 'SUCCESS';
    doc.setFillColor(...(isSuccess ? [224, 247, 234] : [254, 226, 226]));
    doc.roundedRect(left, y - 15, 90, 20, 10, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...(isSuccess ? [56, 161, 105] : [229, 62, 62]));
    doc.text(status, left + 45, y - 5, { align: 'center' });

    if (bankLogoDataUrl) {
      // Scaled to fit a max box while preserving the logo's real aspect ratio,
      // instead of forcing it into a square (which stretched non-square logos).
      const { width: naturalW, height: naturalH } = doc.getImageProperties(bankLogoDataUrl);
      const maxW = 100;
      const maxH = 50;
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
      const logoW = naturalW * scale;
      const logoH = naturalH * scale;
      doc.addImage(bankLogoDataUrl, 'PNG', right - logoW, y - 15 - (logoH - 20) / 2, logoW, logoH);
    }
    y += 60;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(156, 163, 175);
    doc.text('This is a computer-generated receipt from TamilPay.', (left + right) / 2, y, { align: 'center' });

    return doc;
  };

  const downloadReceiptPdf = async (receiptData) => {
    const doc = await buildReceiptPdf(receiptData);
    doc.save(`receipt-${receiptData.transactionId ?? 'transfer'}.pdf`);
  };

  const shareReceiptPdf = async (receiptData) => {
    const doc = await buildReceiptPdf(receiptData);
    const fileName = `receipt-${receiptData.transactionId ?? 'transfer'}.pdf`;
    const pdfFile = new File([doc.output('blob')], fileName, { type: 'application/pdf' });

    if (navigator.canShare?.({ files: [pdfFile] })) {
      try {
        await navigator.share({ title: 'Transfer Receipt', files: [pdfFile] });
      } catch {
        // Share cancelled — nothing to do.
      }
      return;
    }

    // No file-sharing support in this browser — fall back to just downloading the PDF.
    doc.save(fileName);
  };

  const handleDownloadReceipt = () => receipt && downloadReceiptPdf(receipt);
  const handleShareReceipt = () => receipt && shareReceiptPdf(receipt);

  // History rows only carry the beneficiary's account/IFSC, not the bank's name or
  // logo — those live on the sender's registered bank accounts, so they're looked up
  // there by account number before building that row's receipt.
  const buildReceiptFromHistoryRow = async (t) => {
    let bankName = '';
    let bankLogoUrl = null;
    try {
      const res = await fetch(apiUrl(`/api/bankaccounts?clientId=${MASTER_CLIENT_ID}&mobileNumber=${t.senderMobile}`));
      if (res.ok) {
        const accounts = await res.json();
        const match = accounts.find((acc) => acc.AccountNumber === t.accountNumber) ?? accounts[0];
        bankName = match?.BankName ?? '';
        bankLogoUrl = match?.BankLogoUrl ?? null;
      }
    } catch {
      // Bank lookup failed — the receipt still generates, just without a bank name/logo.
    }

    return {
      transactionId: t.id,
      utr: t.utr,
      status: t.status,
      dateTime: new Date(t.createdTime).toLocaleString(),
      senderName: t.senderName,
      senderMobile: t.senderMobile,
      accountHolderName: t.accountHolderName,
      accountNumber: t.accountNumber,
      ifsc: t.ifsc,
      bankName,
      bankLogoUrl,
      amount: Number(t.amount),
    };
  };

  const handleDownloadHistoryReceipt = async (t) => downloadReceiptPdf(await buildReceiptFromHistoryRow(t));
  const handleShareHistoryReceipt = async (t) => shareReceiptPdf(await buildReceiptFromHistoryRow(t));

  // Selecting a beneficiary doesn't navigate anywhere — it just fills the
  // Transfer panel alongside the list, both visible on the same screen.
  const selectBeneficiary = (b) => {
    setSelectedBeneficiary(b);
    setTransferForm(EMPTY_TRANSFER_FORM);
    setTransferFieldErrors({});
    setTransferFormError(null);
    setTransferSuccess(false);
    setReceipt(null);
    setShowReceipt(false);
  };

  // Switching which of the sender's own bank accounts to pay into clears the
  // previous attempt's form/success/receipt — that all belonged to the old account.
  const selectTransferAccount = (acc) => {
    setTransferAccount(acc);
    setTransferForm(EMPTY_TRANSFER_FORM);
    setTransferFieldErrors({});
    setTransferFormError(null);
    setTransferSuccess(false);
    setReceipt(null);
    setShowReceipt(false);
  };

  const resetToInput = () => {
    setStep('input');
    setMobileNumber('');
    setMobileError(null);
    setSender(null);
    setBankAccounts([]);
    setAccountSearch('');
    setTransferAccount(null);
    setShowBankForm(false);
    setBeneficiaries([]);
    setSelectedBeneficiary(null);
    setTransferForm(EMPTY_TRANSFER_FORM);
    setTransferFieldErrors({});
    setTransferFormError(null);
    setTransferSuccess(false);
    setReceipt(null);
    setShowReceipt(false);
  };

  // One common Back for the whole flow — no matter how many screens deep you are
  // (verified, register, or beneficiary), Back always goes straight to the single
  // starting screen (the mobile number input) in one click, not through each
  // intermediate step. From the starting screen, Back leaves the flow entirely (Home).
  // The one exception: while the bank account form is open, Back/Cancel return to
  // wherever that form was actually opened from, since that's a short-lived overlay
  // on top of the current screen, not a step in the main flow.
  const handleTopBack = () => {
    if (showBankForm) {
      setShowBankForm(false);
      setStep(bankFormReturnStep);
      return;
    }
    if (step === 'input') {
      onNavigate?.('home');
      return;
    }
    resetToInput();
  };

  return (
    <div
      className="theme-blue"
      style={{
        position: 'relative',
        minHeight: 'calc(100vh - 64px)',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(var(--theme-accent-rgb),0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '20px clamp(16px, 5vw, 80px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: '100%', maxWidth: 900, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
          }}
        >
          <button
            className="btn-ghost"
            onClick={handleTopBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
              fontSize: 14, padding: 0, flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>

          {step === 'verified' && sender && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
              <CheckCircle2 size={15} color="#38A169" />
              <span style={{ fontWeight: 700, color: 'var(--theme-heading)' }}>{sender.SenderName}</span>
              <span style={{ color: '#B0B8C4' }}>|</span>
              <span style={{ color: '#4A5568' }}>{sender.mobileNumber}</span>
              {/* Senders registered earlier may carry these; new ones are name-only. */}
              {[sender.SenderAddress, sender.senderPan, sender.senderAadhaar].filter(Boolean).map((detail) => (
                <React.Fragment key={detail}>
                  <span style={{ color: '#B0B8C4' }}>|</span>
                  <span style={{ color: '#4A5568' }}>{detail}</span>
                </React.Fragment>
              ))}
            </div>
          )}

        </div>

        {step === 'verified' && sender && (
          <div className="two-col-grid">
          <div style={{ ...cardStyle, minWidth: 0, maxWidth: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Landmark size={16} color="var(--theme-heading)" />
                <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--theme-heading)', margin: 0 }}>
                  Bank Account
                </h2>
              </div>

              {!showBankForm && (
                <button
                  type="button"
                  onClick={() => {
                    setBankForm(EMPTY_BANK_FORM);
                    setBankFieldErrors({});
                    setBankFormError(null);
                    setVerifyError(null);
                    setBankFormReturnStep('verified');
                    setShowBankForm(true);
                  }}
                  className="signin-btn"
                  style={{ width: 'auto', padding: '0 16px', height: 34, fontSize: 13 }}
                >
                  <Plus size={14} strokeWidth={2.5} /> Add Bank Account
                </button>
              )}
            </div>

            {!showBankForm && (
              bankAccounts.length > 0 ? (
                <>
                  {/* Find an account by the holder's name or the account number (also the bank
                      or IFSC) — the list can run to dozens of accounts for one sender. */}
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <Search size={16} color="#B0B8C4" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search by name or account number…"
                      aria-label="Search bank accounts"
                      autoComplete="off"
                      value={accountSearch}
                      onChange={(e) => setAccountSearch(e.target.value)}
                    />
                  </div>

                  {filteredBankAccounts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', paddingRight: 4 }}>
                      {filteredBankAccounts.map((acc) => (
                        <BankAccountCard key={acc.id} account={acc} onClick={() => selectTransferAccount(acc)} />
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: 0 }}>
                      No bank account matches “{accountSearch.trim()}”.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: 0 }}>
                  No bank account registered for this sender yet.
                </p>
              )
            )}

            {showBankForm && (
              <form onSubmit={handleAddBankAccount}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 20px' }}>
                  <Field label="Bank Name" error={bankFieldErrors.bankName}>
                    <BankCombobox
                      banks={banks}
                      value={bankForm.bankName}
                      onSelect={(bank) => setBankForm((f) => ({
                        ...f,
                        bankName: bank?.BankName ?? '',
                        // Keep what is typed in the IFSC box if the choice is cleared mid-edit.
                        ifsc: bank?.IFSC_Code || f.ifsc,
                      }))}
                    />
                  </Field>

                  <Field label="Account Number" error={bankFieldErrors.accountNumber}>
                    <input
                      type="text" inputMode="numeric" className="form-input no-icon" maxLength={18}
                      value={bankForm.accountNumber}
                      onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
                    />
                  </Field>

                  <Field label="IFSC Code" error={bankFieldErrors.ifsc}>
                    <input
                      type="text" className="form-input no-icon"
                      placeholder={selectedBank ? `e.g. ${selectedBank.IFSC_Code}` : 'e.g. ABCD0123456'}
                      maxLength={11}
                      style={{ textTransform: 'uppercase' }}
                      value={bankForm.ifsc} onChange={(e) => setBankForm((b) => ({ ...b, ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) }))}
                    />
                  </Field>

                  <Field label="Account Holder Name" error={bankFieldErrors.accountHolderName}>
                    <input
                      type="text" className="form-input no-icon"
                      value={bankForm.accountHolderName} onChange={updateBankField('accountHolderName')}
                    />
                  </Field>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...labelStyle, visibility: 'hidden' }}>Verify</label>
                    <button
                      type="button"
                      onClick={handleVerifyAccount}
                      disabled={verifyingAccount}
                      className="signin-btn"
                      style={{ width: 'auto', padding: '0 20px', height: 38 }}
                    >
                      <CheckCircle2 size={14} /> {verifyingAccount ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                </div>

                {verifyError && <p style={fieldErrorStyle}>{verifyError}</p>}
                {bankFormError && <p style={fieldErrorStyle}>{bankFormError}</p>}

                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="submit" className="signin-btn" disabled={bankSubmitting} style={{ width: 'auto', padding: '0 20px', height: 38 }}>
                    {bankSubmitting ? 'Saving…' : 'Save Bank Account'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleTopBack}
                    disabled={bankSubmitting}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491',
                      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ ...cardStyle, minWidth: 0, maxWidth: 'none' }}>
            {transferAccount && !showBankForm ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Landmark size={16} color="var(--theme-heading)" />
                  <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--theme-heading)', margin: 0 }}>
                    Transfer
                  </h2>
                </div>

                <BankAccountCard account={transferAccount} />

                <form onSubmit={handleTransferSubmit} style={{ marginTop: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 20px' }}>
                    <Field label="Amount" error={transferFieldErrors.amount}>
                      <input
                        type="text" inputMode="numeric" className="form-input no-icon"
                        placeholder="e.g. 500" autoComplete="off"
                        value={transferForm.amount}
                        onChange={handleAmountChange}
                      />
                      {transferForm.amount && !Number.isNaN(payoutChargeAmount) && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#7C8491', margin: '6px 0 0' }}>
                          Payout charges: ₹{payoutChargeAmount.toFixed(2)}
                        </p>
                      )}
                    </Field>

                    <Field label="PIN" error={transferFieldErrors.pin}>
                      <input
                        type="password" inputMode="numeric" className="form-input no-icon" maxLength={6}
                        autoComplete="off"
                        value={transferForm.pin} onChange={updateTransferField('pin')}
                      />
                    </Field>
                  </div>

                  {transferFormError && <p style={fieldErrorStyle}>{transferFormError}</p>}
                  {transferSuccess && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#38A169', margin: '0 0 12px' }}>
                      Transfer submitted successfully.
                    </p>
                  )}
                  {receipt && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                      <button type="button" onClick={() => setShowReceipt(true)} className="icon-btn-anim" style={receiptBtnStyle}>
                        <Receipt size={14} /> View
                      </button>
                      <button type="button" onClick={handleDownloadReceipt} className="icon-btn-anim" style={receiptBtnStyle}>
                        <Download size={14} /> Download
                      </button>
                      <button type="button" onClick={handleShareReceipt} className="icon-btn-anim" style={receiptBtnStyle}>
                        <Share2 size={14} /> Share
                      </button>
                    </div>
                  )}

                  <button type="submit" disabled={transferSubmitting} className="signin-btn" style={{ width: 'auto', padding: '0 24px', height: 38 }}>
                    {transferSubmitting ? 'Submitting…' : 'Submit'}
                  </button>
                </form>
              </>
            ) : (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: 0 }}>
                {bankAccounts.length > 0 ? 'Click on a bank account to transfer.' : 'Add a bank account to enable transfer.'}
              </p>
            )}
          </div>
          </div>
        )}

        {step === 'beneficiary' && (
          <div className="two-col-grid">
            <div
              style={{
                minWidth: 0,
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.08)',
              }}
            >
              {/* Top bar */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                  padding: '16px 20px', background: '#F3F7FD', borderBottom: '1px solid rgba(var(--theme-heading-rgb),0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="var(--theme-accent)" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '1px', color: 'var(--theme-heading)', textTransform: 'uppercase' }}>
                    Select Beneficiary
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBankForm(EMPTY_BANK_FORM);
                    setBankFieldErrors({});
                    setBankFormError(null);
                    setVerifyError(null);
                    setBankFormReturnStep('beneficiary');
                    setStep('verified');
                    setShowBankForm(true);
                  }}
                  className="signin-btn"
                  style={{ width: 'auto', padding: '0 16px', height: 34, fontSize: 13 }}
                >
                  <Plus size={14} strokeWidth={2.5} /> Add New
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Search bar */}
                <div style={{ position: 'relative', marginBottom: 24 }}>
                  <Search size={16} color="#B0B8C4" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by name or account number…"
                    value={beneficiarySearch}
                    onChange={(e) => setBeneficiarySearch(e.target.value)}
                  />
                </div>

                {/* Section label — stays put; only the list below it scrolls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Landmark size={15} color="var(--theme-accent)" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '1px', color: 'var(--theme-heading)', textTransform: 'uppercase' }}>
                    Bank Accounts
                  </span>
                </div>
                <div style={{ height: 1, background: 'rgba(var(--theme-heading-rgb),0.08)', marginBottom: 16 }} />

                <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: 4 }}>
                  {beneficiariesLoading && (
                    <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', fontSize: 13.5 }}>Loading beneficiaries…</p>
                  )}

                  {!beneficiariesLoading && filteredBeneficiaries.length === 0 && (
                    <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', fontSize: 13.5 }}>No matching bank accounts found.</p>
                  )}

                  {!beneficiariesLoading && filteredBeneficiaries.map((b) => (
                    <div key={b.id} style={{ marginBottom: 10 }}>
                      <BankAccountCard
                        account={b}
                        onClick={() => selectBeneficiary(b)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, width: '100%', minWidth: 0, maxWidth: 'none' }}>
              {selectedBeneficiary ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Landmark size={16} color="var(--theme-heading)" />
                    <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--theme-heading)', margin: 0 }}>
                      Transfer
                    </h2>
                  </div>

                  <BankAccountCard account={selectedBeneficiary} />

                  <form onSubmit={handleTransferSubmit} style={{ marginTop: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 20px' }}>
                      <Field label="Amount" error={transferFieldErrors.amount}>
                        <input
                          type="text" inputMode="numeric" className="form-input no-icon"
                          placeholder="e.g. 500" autoComplete="off"
                          value={transferForm.amount}
                          onChange={handleAmountChange}
                        />
                        {transferForm.amount && !Number.isNaN(payoutChargeAmount) && (
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#7C8491', margin: '6px 0 0' }}>
                            Payout charges: ₹{payoutChargeAmount.toFixed(2)}
                          </p>
                        )}
                      </Field>

                      <Field label="PIN" error={transferFieldErrors.pin}>
                        <input
                          type="password" inputMode="numeric" className="form-input no-icon" maxLength={6}
                          autoComplete="off"
                          value={transferForm.pin} onChange={updateTransferField('pin')}
                        />
                      </Field>
                    </div>

                    {transferFormError && <p style={fieldErrorStyle}>{transferFormError}</p>}
                    {transferSuccess && (
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#38A169', margin: '0 0 12px' }}>
                        Transfer submitted successfully.
                      </p>
                    )}
                    {receipt && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        <button type="button" onClick={() => setShowReceipt(true)} className="icon-btn-anim" style={receiptBtnStyle}>
                          <Receipt size={14} /> View
                        </button>
                        <button type="button" onClick={handleDownloadReceipt} className="icon-btn-anim" style={receiptBtnStyle}>
                          <Download size={14} /> Download
                        </button>
                        <button type="button" onClick={handleShareReceipt} className="icon-btn-anim" style={receiptBtnStyle}>
                          <Share2 size={14} /> Share
                        </button>
                      </div>
                    )}

                    <button type="submit" disabled={transferSubmitting} className="signin-btn" style={{ width: 'auto', padding: '0 24px', height: 38 }}>
                      {transferSubmitting ? 'Submitting…' : 'Submit'}
                    </button>
                  </form>
                </>
              ) : (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: 0 }}>
                  Select a beneficiary from the list to transfer money.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="two-col-grid">
            <div style={{ ...cardStyle, minWidth: 0 }}>
              <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--theme-heading)', margin: '0 0 4px' }}>
                IMPS Transfer
              </h1>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: '0 0 24px' }}>
                Enter the sender's mobile number to verify or register them.
              </p>

              <form onSubmit={handleVerify}>
                <Field label="Sender Number" error={mobileError}>
                  <input
                    type="text" inputMode="numeric" className="form-input no-icon" placeholder="9876543210" maxLength={10}
                    autoComplete="off"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    required
                  />
                </Field>

                <button type="submit" className="signin-btn" disabled={verifying} style={{ marginTop: 8 }}>
                  <Search size={16} />
                  {verifying ? 'Verifying…' : 'Verify Sender'}
                </button>
              </form>
            </div>

            <div style={{ ...cardStyle, minWidth: 0, maxWidth: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--theme-heading)', margin: 0 }}>
                  Today's Transactions
                </h2>
                <button
                  type="button"
                  className="icon-btn-anim"
                  title="Refresh"
                  onClick={refreshTodayTransactions}
                  disabled={isLoadingTodayTransactions}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
                >
                  <RefreshCw size={16} color="#7C8491" className={isLoadingTodayTransactions ? 'spin' : ''} />
                </button>
              </div>

              {isLoadingTodayTransactions && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: 0 }}>Loading…</p>
              )}

              {!isLoadingTodayTransactions && todayTransactions.length === 0 && (
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: 0 }}>
                  No transactions yet today.
                </p>
              )}

              {!isLoadingTodayTransactions && todayTransactions.length > 0 && (
                <div className="table-scroll" style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ textAlign: 'left' }}>
                        {['ID', 'Time', 'Account', 'Amount', 'UTR', 'Status', ''].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '6px 8px', fontSize: 10.5, letterSpacing: '0.5px', textTransform: 'uppercase',
                              color: '#9CA3AF', fontWeight: 700, borderBottom: '1px solid rgba(var(--theme-heading-rgb),0.08)', whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todayTransactions.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(var(--theme-heading-rgb),0.05)' }}>
                          <td style={{ padding: '8px', color: '#4A5568' }}>{t.id}</td>
                          <td style={{ padding: '8px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                            {new Date(t.createdTime).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--theme-heading)' }}>
                            <div style={{ fontWeight: 600 }}>{t.accountHolderName}</div>
                            <div style={{ color: '#9CA3AF', fontSize: 11.5 }}>{t.accountNumber} · {t.ifsc}</div>
                          </td>
                          <td style={{ padding: '8px', color: 'var(--theme-heading)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            ₹{Number(t.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px', color: '#4A5568' }}>{t.utr || '—'}</td>
                          <td style={{ padding: '8px' }}>
                            <span
                              style={{
                                display: 'inline-block', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                background: t.status === 'SUCCESS' ? '#E0F7EA' : '#FFF5F5',
                                color: t.status === 'SUCCESS' ? '#38A169' : '#E53E3E',
                              }}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                className="icon-btn-anim"
                                title="Download receipt"
                                onClick={() => handleDownloadHistoryReceipt(t)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
                              >
                                <Download size={14} color="#7C8491" />
                              </button>
                              <button
                                type="button"
                                className="icon-btn-anim"
                                title="Share receipt"
                                onClick={() => handleShareHistoryReceipt(t)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
                              >
                                <Share2 size={14} color="#7C8491" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'register' && (
          <div style={cardStyle}>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--theme-heading)', margin: '0 0 4px' }}>
              Register IMPS Sender
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#7C8491', margin: '0 0 20px' }}>
              No sender is registered for <strong>{mobileNumber}</strong> yet. Enter the sender's name once to enable IMPS transfers.
            </p>

            <form onSubmit={handleRegister}>
              <Field label="Sender Name" error={fieldErrors.senderName}>
                <input type="text" className="form-input no-icon" value={form.senderName} onChange={updateField('senderName')} required />
              </Field>

              {formError && <p style={fieldErrorStyle}>{formError}</p>}

              <button type="submit" className="signin-btn" disabled={submitting} style={{ marginTop: 8 }}>
                {submitting ? 'Registering…' : 'Register Sender'}
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={resetToInput}
                disabled={submitting}
                style={{
                  display: 'block', background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5, padding: 0, marginTop: 14,
                }}
              >
                Use a different number
              </button>
            </form>
          </div>
        )}
      </div>

      {showReceipt && receipt && (
        <Modal onClose={resetToInput} themeClassName="theme-blue" style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 420, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={tamilPayLogo} alt="TamilPay" style={{ height: 32, width: 'auto' }} />
              <div style={{ lineHeight: 1.4 }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13.5, color: 'var(--theme-heading)', margin: 0 }}>
                  {storeDetails?.STORE_NAME ?? user?.STORE_NAME}
                </p>
                {storeDetails?.STORE_ADDRESS && (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: '#7C8491', margin: 0 }}>
                    {storeDetails.STORE_ADDRESS}
                  </p>
                )}
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: '#7C8491', margin: 0 }}>
                  {storeDetails?.MOBILE_NUMBER ?? user?.MOBILE_NUMBER}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="icon-btn-anim"
              onClick={resetToInput}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}
            >
              <X size={18} color="#7C8491" />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--theme-heading)', margin: 0 }}>
              Transfer Receipt
            </h2>
          </div>

          <div style={{ height: 1, background: 'rgba(var(--theme-heading-rgb),0.08)', margin: '0 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 10, fontFamily: 'Inter, sans-serif', fontSize: 13.5 }}>
            <span style={{ color: '#9CA3AF' }}>Transaction ID</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.transactionId ?? '—'}</strong>

            <span style={{ color: '#9CA3AF' }}>Date</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.dateTime}</strong>

            <span style={{ color: '#9CA3AF' }}>Sender</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.senderName} ({receipt.senderMobile})</strong>

            <span style={{ color: '#9CA3AF' }}>Beneficiary</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.accountHolderName}</strong>

            <span style={{ color: '#9CA3AF' }}>Account Number</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.accountNumber}</strong>

            <span style={{ color: '#9CA3AF' }}>IFSC</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.ifsc}</strong>

            <span style={{ color: '#9CA3AF' }}>Bank</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.bankName}</strong>

            <span style={{ color: '#9CA3AF' }}>Amount</span>
            <strong style={{ color: 'var(--theme-heading)' }}>₹{receipt.amount.toFixed(2)}</strong>

            <span style={{ color: '#9CA3AF' }}>UTR</span>
            <strong style={{ color: 'var(--theme-heading)' }}>{receipt.transactionId ?? '—'}</strong>
          </div>

          <div style={{ height: 1, background: 'rgba(var(--theme-heading-rgb),0.08)', margin: '16px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: '#38A169', margin: 0 }}>
              Status: Success
            </p>
            {receipt.bankLogoUrl && (
              <img src={receipt.bankLogoUrl} alt={receipt.bankName} style={{ height: 72, width: 72, objectFit: 'contain' }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
            <button type="button" onClick={handleDownloadReceipt} className="icon-btn-anim" style={receiptBtnStyle}>
              <Download size={14} /> Download
            </button>
            <button type="button" onClick={handleShareReceipt} className="icon-btn-anim" style={receiptBtnStyle}>
              <Share2 size={14} /> Share
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ImpsPage;
