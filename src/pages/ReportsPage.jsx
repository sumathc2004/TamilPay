import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, BookOpen, ChevronRight, CreditCard, FileSpreadsheet, FileText, Printer, QrCode, Receipt, Search, Share2, Download, RefreshCw, WalletCards, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { buildXlsx } from '../utils/xlsx';
import { apiUrl } from '../utils/api';
import DateRangeFields from '../components/DateRangeFields';
import SearchSelect from '../components/SearchSelect';
import { loadImageAsDataUrl } from '../utils/pdf';
import { MASTER_CLIENT_ID } from '../utils/customer';
import { pick } from '../utils/pick';
import tamilPayLogo from '../assets/images/tamilpay-logo.png';

// toISOString() reports the UTC date, which drifts a calendar day off the user's own
// "today" depending on timezone and time of day — built from local date parts instead
// so "today" always matches what the user's clock actually says.
const todayIso = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Shorter than toLocaleString() — the PDF's narrow "Time" column can't fit the full
// "9/18/2026, 6:00:34 PM" without running into the next column.
const compactDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.08)',
  padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
};

const exportBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.1)', borderRadius: 8,
  cursor: 'pointer', color: 'var(--theme-heading)', fontFamily: 'Inter, sans-serif', fontWeight: 600,
  fontSize: 12.5, padding: '7px 12px',
};

const money = (v) => `₹${Number(v).toFixed(2)}`;

// Shared by Wallet Ledger and the admin's Admin Ledger Report — same rows, same columns;
// only whose wallet and how it is chosen differ.
const ledgerReport = {
  label: 'Wallet Ledger',
  description: 'Every debit and credit on your wallet',
  icon: BookOpen,
  fetchUrl: ({ walletId, fromDate, toDate }) => apiUrl(`/api/transactions/ledger?walletId=${walletId}&fromDate=${fromDate}&toDate=${toDate}`),
  headers: ['ID', 'Time', 'Type', 'Details', 'Debit', 'Credit', 'Charges', 'Balance', 'UTR', 'Status'],
  cells: (r) => [
    r.id,
    new Date(r.createdTime).toLocaleString(),
    <span key="type" style={{ fontWeight: 700, color: r.txnType === 'CREDIT' ? '#38A169' : '#E53E3E' }}>{r.txnType}</span>,
    r.accountHolderName
      ? <div key="details">
          <div style={{ fontWeight: 600 }}>{r.accountHolderName}</div>
          <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.accountNumber} · {r.ifsc}</div>
        </div>
      : (r.remarks || '—'),
    r.debit > 0 ? money(r.debit) : '—',
    r.credit > 0 ? money(r.credit) : '—',
    r.charges > 0 ? money(r.charges) : '—',
    <span key="balance" style={{ fontWeight: 700 }}>{money(r.balance)}</span>,
    r.utr || '—',
    <StatusBadge key="status" status={r.status} />,
  ],
  exportRow: (r) => [r.id, new Date(r.createdTime).toLocaleString(), r.txnType, r.accountHolderName || r.remarks, Number(r.debit).toFixed(2), Number(r.credit).toFixed(2), Number(r.charges).toFixed(2), Number(r.balance).toFixed(2), r.utr || '', r.status],
  exportHeaders: ['ID', 'Time', 'Type', 'Details', 'Debit', 'Credit', 'Charges', 'Balance', 'UTR', 'Status'],
  exportWidths: [0.35, 1.3, 0.7, 1.5, 0.85, 0.85, 0.8, 0.95, 1.1, 0.75],
  exportAligns: ['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'left', 'left'],
  // Colors the "Type" column in the PDF the same way the on-screen table does.
  exportCellColor: (r, header) => (header === 'Type' ? (r.txnType === 'CREDIT' ? [56, 161, 105] : [229, 62, 62]) : null),
};

// Each report is just a data source + how to render one row, both as a table cell
// (JSX) and as a flat value (for CSV/PDF export) — the surrounding page (date range,
// search, export buttons, table shell) is identical for every report. fetchUrl takes
// the wallet/date range and builds the actual request — most reports live under
// /api/transactions, but PG Reports is a different upstream API with its own shape.
//
// A function of isAdmin rather than a static object — PG Reports' Partner Charges and
// Profit columns are internal margin data (what TamilPay pays the PG partner and keeps
// as profit on each link), so only Admin logins see them; Retailers get the same rows
// without those two columns.
// A payment link the report still calls PENDING may already have been decided at the bank, or
// never started. Pg/CheckStatus (through our /api/pg/status, which returns only the outcome,
// amount, UTR and card) asks the bank, using the payment's reference number.
const isPgPending = (r) => r.status === 'PENDING' && Boolean(r.pipeRefNumber);
const checkPgStatus = async (r) => {
  const res = await fetch(apiUrl(`/api/pg/status?referenceId=${encodeURIComponent(r.pipeRefNumber)}`));
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? `Could not check the payment (${res.status})`);
  return body;
};

const buildReports = (isAdmin) => ({
  transfer: {
    label: 'Transfer Reports',
    description: 'IMPS transfers over a date range',
    icon: Receipt,
    fetchUrl: ({ walletId, fromDate, toDate }) => apiUrl(`/api/transactions/report?walletId=${walletId}&fromDate=${fromDate}&toDate=${toDate}`),
    headers: ['ID', 'Time', 'Account', 'Amount', 'UTR', 'Status'],
    cells: (r) => [
      r.id,
      new Date(r.createdTime).toLocaleString(),
      <div key="account">
        <div style={{ fontWeight: 600 }}>{r.accountHolderName}</div>
        <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.accountNumber} · {r.ifsc}</div>
      </div>,
      <span key="amount" style={{ fontWeight: 700 }}>{money(r.amount)}</span>,
      r.utr || '—',
      <StatusBadge key="status" status={r.status} />,
    ],
    exportRow: (r) => [r.id, new Date(r.createdTime).toLocaleString(), r.accountHolderName, r.accountNumber, r.ifsc, Number(r.amount).toFixed(2), r.utr || '', r.status],
    exportHeaders: ['ID', 'Time', 'Account Holder', 'Account Number', 'IFSC', 'Amount', 'UTR', 'Status'],
    // Relative column widths for the PDF — equal-width columns overflowed onto each
    // other since fields like the full date/time string are much wider than "ID".
    exportWidths: [0.4, 1.3, 1.5, 1.4, 1, 0.9, 1.1, 0.8],
    exportAligns: ['left', 'left', 'left', 'left', 'left', 'right', 'left', 'left'],
    // Per-row Print / Download / Share receipt (see ReportsPage).
    receipt: (r) => ({
      title: 'Transfer Receipt',
      status: r.status,
      rows: [
        ['Transaction ID', r.id],
        ['Date & Time', new Date(r.createdTime).toLocaleString()],
        ['Account Holder', r.accountHolderName],
        ['Account Number', r.accountNumber],
        ['IFSC', r.ifsc],
        ['Amount', money(r.amount)],
        ['UTR', r.utr || '—'],
        ['Status', r.status],
      ],
    }),
  },
  // Available to every login (Retailer and Admin) — same wallet-scoped call either way.
  // Confirmed directly that a walletId of 0 (which an admin-role wallet can have) makes
  // the remote API return every wallet on the client pooled together rather than erroring,
  // so "Retailer" (the API's "customerName", i.e. the wallet owner) gets its own column —
  // with rows from more than one wallet possibly in play, it's what tells them apart.
  // "Customer" is payerName — who that specific link was actually made for.
  pgReports: {
    label: 'PG Reports',
    description: 'Payment gateway links generated over a date range',
    icon: CreditCard,
    // An admin's own wallet has no PG activity of its own — walletId 0 is what makes the
    // remote API return every wallet on the client pooled together, so admins get that
    // instead of their own always-empty history. Retailers still get their own wallet.
    resolveWalletId: (u) => ((u?.roleName || '').toLowerCase() === 'admin' ? 0 : u?.walletId),
    fetchUrl: ({ clientId, walletId, fromDate, toDate }) =>
      apiUrl(`/api/pg/transfer-report?clientId=${clientId}&walletId=${walletId}&fromDate=${fromDate}&toDate=${toDate}`),
    isPending: isPgPending,
    checkRow: checkPgStatus,
    headers: [
      'ID', 'Time', 'PG', 'Retailer', 'Customer', 'Card', 'Amount', 'Charges',
      ...(isAdmin ? ['Partner Charges', 'Profit'] : []),
      'Status', 'Credited', 'Closing Balance',
    ],
    cells: (r) => [
      r.id,
      new Date(r.createdTime).toLocaleString(),
      <PgCell key="pg" r={r} />,
      <RetailerCell key="retailer" name={r.customerName} mobile={r.username} />,
      r.payerName,
      r.cardNumber,
      <span key="amount" style={{ fontWeight: 700 }}>{money(r.amount)}</span>,
      money(r.charges),
      ...(isAdmin ? [money(r.partnerCharges), <span key="profit" style={{ fontWeight: 700, color: '#38A169' }}>{money(r.profit)}</span>] : []),
      <StatusBadge key="status" status={r.status} />,
      r.walletCreditedTime ? new Date(r.walletCreditedTime).toLocaleString() : '—',
      r.walletClosingBalance != null ? money(r.walletClosingBalance) : '—',
    ],
    exportRow: (r) => [
      r.id, new Date(r.createdTime).toLocaleString(), r.pgName, r.pipeRefNumber || '', r.customerName, r.username || '', r.payerName, r.cardNumber,
      Number(r.amount).toFixed(2), Number(r.charges).toFixed(2),
      ...(isAdmin ? [Number(r.partnerCharges).toFixed(2), Number(r.profit).toFixed(2)] : []),
      r.status,
      r.walletCreditedTime ? new Date(r.walletCreditedTime).toLocaleString() : '',
      r.walletClosingBalance != null ? Number(r.walletClosingBalance).toFixed(2) : '',
    ],
    exportHeaders: [
      'ID', 'Time', 'PG', 'Reference', 'Retailer', 'Retailer Mobile', 'Customer', 'Card', 'Amount', 'Charges',
      ...(isAdmin ? ['Partner Charges', 'Profit'] : []),
      'Status', 'Credited', 'Closing Balance',
    ],
    exportWidths: [0.35, 1.3, 1, 1.5, 1.1, 1, 1.1, 0.7, 0.85, 0.85, ...(isAdmin ? [0.95, 0.8] : []), 0.8, 1.3, 1],
    exportAligns: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', ...(isAdmin ? ['right', 'right'] : []), 'left', 'left', 'right'],
    // Profit reads green in the PDF too, same as on screen.
    // What the search box matches against: who the link was made for, and the card digits.
    searchText: (r) => [r.payerName, r.cardNumber, r.pipeRefNumber],
    exportCellColor: (r, header) => (header === 'Profit' ? [56, 161, 105] : null),
  },
  // Credit card bill payments (Pay Out > Card Payments). One row per wallet entry: the DEBIT
  // that paid a bill, and for a failed payment the CREDIT that refunded it. Admins see every
  // retailer (walletId 0 pools the client); retailers see their own wallet.
  cardReports: {
    label: 'Credit Card Reports',
    description: 'Credit card bill payments over a date range',
    icon: WalletCards,
    resolveWalletId: (u) => ((u?.roleName || '').toLowerCase() === 'admin' ? 0 : u?.walletId),
    statusOptions: ['SUCCESS', 'FAILED', 'PENDING'],
    fetchUrl: ({ walletId, fromDate, toDate, status }) =>
      apiUrl(`/api/bbps/report?walletId=${walletId}&fromDate=${fromDate}&toDate=${toDate}${status ? `&status=${status}` : ''}`),
    headers: ['ID', 'Time', ...(isAdmin ? ['Retailer', 'Shop'] : []), 'Amount', 'Charges', 'Closing Balance', 'NPCI Ref', 'Status', 'Consumer Name', 'Card Number'],
    cells: (r) => [
      r.Id,
      new Date(r.createdTime).toLocaleString(),
      ...(isAdmin ? [
        <div key="retailer">
          <div style={{ fontWeight: 600 }}>{r.retailerName || '—'}</div>
          <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.MOBILE_NUMBER || r.username || ''}</div>
        </div>,
        r.storeName || '—',
      ] : []),
      <span key="amount" style={{ fontWeight: 700 }}>{money(r.Amount)}</span>,
      money(r.charges),
      money(r.closingbalance),
      r.npciRef || '—',
      <StatusBadge key="status" status={r.status} />,
      pick(r, ['ConsumerName', 'consumerName', 'customerName', 'CustomerName']) || '—',
      pick(r, ['cardNumber', 'CardNumber', 'card_number']) || '—',
    ],
    exportRow: (r) => [
      r.Id, new Date(r.createdTime).toLocaleString(),
      ...(isAdmin ? [r.retailerName || '', r.storeName || ''] : []),
      Number(r.Amount).toFixed(2), Number(r.charges).toFixed(2), Number(r.closingbalance).toFixed(2),
      r.npciRef || '', r.status,
      pick(r, ['ConsumerName', 'consumerName', 'customerName', 'CustomerName']) || '',
      pick(r, ['cardNumber', 'CardNumber', 'card_number']) || '',
    ],
    exportHeaders: ['ID', 'Time', ...(isAdmin ? ['Retailer', 'Shop'] : []), 'Amount', 'Charges', 'Closing Balance', 'NPCI Ref', 'Status', 'Consumer Name', 'Card Number'],
    exportWidths: [0.4, 1.3, ...(isAdmin ? [1.1, 1.3] : []), 0.8, 0.7, 1, 1.6, 0.8, 1.3, 1.2],
    exportAligns: ['left', 'left', ...(isAdmin ? ['left', 'left'] : []), 'right', 'right', 'right', 'left', 'left', 'left', 'left'],
    // Search finds a payment by its NPCI reference or, for admins, the retailer.
    searchText: (r) => [r.npciRef, r.retailerName, r.MOBILE_NUMBER, r.storeName],
    receipt: (r) => ({
      title: r.txntype === 'CREDIT' ? 'Credit Card Payment Refund' : 'Credit Card Payment Receipt',
      status: r.status,
      rows: [
        ['Transaction ID', r.Id],
        ['Date & Time', new Date(r.createdTime).toLocaleString()],
        ...(r.retailerName ? [['Retailer', r.retailerName]] : []),
        ...(r.storeName ? [['Shop', r.storeName]] : []),
        ['Consumer Name', pick(r, ['ConsumerName', 'consumerName', 'customerName', 'CustomerName']) || '—'],
        ['Card Number', pick(r, ['cardNumber', 'CardNumber', 'card_number']) || '—'],
        ['Amount', money(r.Amount)],
        ['Charges', money(r.charges)],
        ['NPCI Ref', r.npciRef || '—'],
        ['Status', r.status],
      ],
    }),
  },
  ledger: ledgerReport,
  // Available to every login, same as Transfer/PG Reports — a walletId of 0 pools
  // every wallet on the client together for admins, same trick pg/TransferReport uses.
  qrReports: {
    label: 'QR Reports',
    description: 'Collect requests created against your QR codes',
    icon: QrCode,
    resolveWalletId: (u) => ((u?.roleName || '').toLowerCase() === 'admin' ? 0 : u?.walletId),
    fetchUrl: ({ walletId }) => apiUrl(`/api/qr/report?walletId=${walletId}`),
    headers: ['ID', 'Time', 'Retailer', 'Store', 'Remarks', 'Amount', 'UTR', 'Status'],
    cells: (r) => {
      const createdTime = pick(r, ['createdTime', 'CreatedTime']);
      return [
        pick(r, ['id', 'Id']) ?? '—',
        createdTime ? new Date(createdTime).toLocaleString() : '—',
        <RetailerCell key="retailer" name={pick(r, ['retailerName', 'RetailerName'])} mobile={pick(r, ['username', 'Username'])} />,
        pick(r, ['QrName', 'qrName']) || '—',
        pick(r, ['remarks', 'Remarks']) || '—',
        <span key="amount" style={{ fontWeight: 700 }}>{money(pick(r, ['amount', 'Amount']) ?? 0)}</span>,
        pick(r, ['utr', 'Utr', 'UTR']) || '—',
        <StatusBadge key="status" status={pick(r, ['status', 'Status']) ?? ''} />,
      ];
    },
    exportRow: (r) => {
      const createdTime = pick(r, ['createdTime', 'CreatedTime']);
      return [
        pick(r, ['id', 'Id']) ?? '',
        createdTime ? new Date(createdTime).toLocaleString() : '',
        pick(r, ['retailerName', 'RetailerName']) ?? '',
        pick(r, ['username', 'Username']) ?? '',
        pick(r, ['QrName', 'qrName']) ?? '',
        pick(r, ['remarks', 'Remarks']) ?? '',
        Number(pick(r, ['amount', 'Amount']) ?? 0).toFixed(2),
        pick(r, ['utr', 'Utr', 'UTR']) ?? '',
        pick(r, ['status', 'Status']) ?? '',
      ];
    },
    exportHeaders: ['ID', 'Time', 'Retailer', 'Retailer Mobile', 'Store', 'Remarks', 'Amount', 'UTR', 'Status'],
    exportWidths: [0.4, 1.3, 1.1, 1, 1.3, 1.5, 0.9, 1, 0.9],
    exportAligns: ['left', 'left', 'left', 'left', 'left', 'left', 'right', 'left', 'left'],
  },
  // Admin-only: every retailer's IMPS transfers on the client at once, not just the
  // logged-in admin's own wallet — hence noWalletRequired and no resolveWalletId.
  ...(isAdmin ? {
    // Admin picks a retailer and reads that wallet's ledger — the same /api/transactions/ledger
    // the retailer sees for themselves, so figures always agree with the retailer's own view.
    adminLedger: {
      ...ledgerReport,
      label: 'Admin Ledger Report',
      description: "Any retailer's wallet ledger over a date range",
      noWalletRequired: true,
      needsCustomer: true,
    },
    adminImpsReport: {
      label: 'Admin IMPS Report',
      description: 'Every retailer\'s IMPS transfers, client-wide',
      icon: ArrowLeftRight,
      noWalletRequired: true,
      fetchUrl: ({ clientId, fromDate, toDate }) => apiUrl(`/api/admin/imps-report?clientId=${clientId}&fromDate=${fromDate}&toDate=${toDate}`),
      headers: ['ID', 'Time', 'Retailer', 'Shop', 'Account', 'Amount', 'UTR', 'Status'],
      cells: (r) => [
        r.id,
        new Date(r.createdTime).toLocaleString(),
        <div key="retailer">
          <div style={{ fontWeight: 600 }}>{r.customerName || `Wallet #${r.walletId}`}</div>
          <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.retailerMobile || ''}</div>
        </div>,
        r.storeName || '—',
        <div key="account">
          <div style={{ fontWeight: 600 }}>{r.accountHolderName}</div>
          <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.accountNumber} · {r.ifsc}</div>
        </div>,
        <span key="amount" style={{ fontWeight: 700 }}>{money(r.amount)}</span>,
        r.utr || '—',
        <StatusBadge key="status" status={r.status} />,
      ],
      exportRow: (r) => [
        r.id, new Date(r.createdTime).toLocaleString(), r.customerName || `Wallet #${r.walletId}`, r.retailerMobile || '', r.storeName || '',
        r.accountHolderName, r.accountNumber, r.ifsc, Number(r.amount).toFixed(2), r.utr || '', r.status,
      ],
      exportHeaders: ['ID', 'Time', 'Retailer', 'Retailer Mobile', 'Shop', 'Account Holder', 'Account Number', 'IFSC', 'Amount', 'UTR', 'Status'],
      exportWidths: [0.35, 1.3, 1.1, 1, 1.2, 1.4, 1.4, 1, 0.9, 1.1, 0.8],
      exportAligns: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'left', 'left'],
    },
    // Every retailer's PG links, client-wide — same shape as the "PG Reports" entry
    // above, just unscoped (retailerName instead of customerName, no walletId at all).
    // Every retailer's QR collect requests, client-wide (Qr/Request/Report with no wallet) —
    // the same rows as Admin > QR Requests' "All Requests", with every field the API returns.
    // That endpoint ignores dates, so clientDateFilter narrows by the chosen range here.
    adminQrReport: {
      label: 'Admin QR Report',
      description: "Every retailer's QR collect requests, client-wide",
      icon: QrCode,
      noWalletRequired: true,
      clientDateFilter: true,
      fetchUrl: () => apiUrl('/api/qr/admin-report'),
      headers: ['ID', 'Time', 'Retailer', 'Store', 'VPA', 'Amount', 'Charges', 'Credit Amount', 'UTR', 'Status', 'Approved Time', 'Closing Balance', 'Remarks'],
      cells: (r) => [
        r.Id,
        new Date(r.createdTime).toLocaleString(),
        <RetailerCell key="retailer" name={r.retailerName} mobile={r.username} />,
        r.QrName || '—',
        r.Vpa || '—',
        <span key="amount" style={{ fontWeight: 700 }}>{money(r.Amount)}</span>,
        money(r.charges),
        money(r.creditAmount),
        r.UTR || '—',
        <StatusBadge key="status" status={r.status} />,
        r.approvedTime ? new Date(r.approvedTime).toLocaleString() : '—',
        r.walletClosingBalance != null ? money(r.walletClosingBalance) : '—',
        r.remarks || '—',
      ],
      exportRow: (r) => [
        r.Id, new Date(r.createdTime).toLocaleString(), r.retailerName || '', r.username || '', r.QrName || '', r.Vpa || '',
        Number(r.Amount).toFixed(2), Number(r.charges).toFixed(2), Number(r.creditAmount).toFixed(2), r.UTR || '', r.status,
        r.approvedTime ? new Date(r.approvedTime).toLocaleString() : '',
        r.walletClosingBalance != null ? Number(r.walletClosingBalance).toFixed(2) : '',
        r.remarks || '',
      ],
      exportHeaders: ['ID', 'Time', 'Retailer', 'Retailer Mobile', 'Store', 'VPA', 'Amount', 'Charges', 'Credit Amount', 'UTR', 'Status', 'Approved Time', 'Closing Balance', 'Remarks'],
      exportWidths: [0.35, 1.3, 1, 0.95, 1.1, 1.4, 0.8, 0.7, 0.85, 0.8, 0.8, 1.3, 0.95, 1],
      exportAligns: ['left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'left', 'left', 'left', 'right', 'left'],
    },
    adminPgReport: {
      label: 'Admin PG Report',
      description: 'Every retailer\'s PG links, client-wide',
      icon: CreditCard,
      noWalletRequired: true,
      isPending: isPgPending,
      checkRow: checkPgStatus,
      fetchUrl: ({ clientId, fromDate, toDate }) => apiUrl(`/api/admin/pg-report?clientId=${clientId}&fromDate=${fromDate}&toDate=${toDate}`),
      headers: ['ID', 'Time', 'PG', 'Retailer', 'Customer', 'Card', 'Amount', 'Charges', 'Partner Charges', 'Profit', 'Status', 'Credited', 'Closing Balance'],
      cells: (r) => [
        r.id,
        new Date(r.createdTime).toLocaleString(),
        <PgCell key="pg" r={r} />,
        <RetailerCell key="retailer" name={r.retailerName} mobile={r.username} />,
        r.payerName,
        r.cardNumber,
        <span key="amount" style={{ fontWeight: 700 }}>{money(r.amount)}</span>,
        money(r.charges),
        money(r.partnerCharges),
        <span key="profit" style={{ fontWeight: 700, color: '#38A169' }}>{money(r.profit)}</span>,
        <StatusBadge key="status" status={r.status} />,
        r.walletCreditedTime ? new Date(r.walletCreditedTime).toLocaleString() : '—',
        r.walletClosingBalance != null ? money(r.walletClosingBalance) : '—',
      ],
      exportRow: (r) => [
        r.id, new Date(r.createdTime).toLocaleString(), r.pgName, r.pipeRefNumber || '', r.retailerName, r.username || '', r.payerName, r.cardNumber,
        Number(r.amount).toFixed(2), Number(r.charges).toFixed(2), Number(r.partnerCharges).toFixed(2), Number(r.profit).toFixed(2), r.status,
        r.walletCreditedTime ? new Date(r.walletCreditedTime).toLocaleString() : '',
        r.walletClosingBalance != null ? Number(r.walletClosingBalance).toFixed(2) : '',
      ],
      exportHeaders: ['ID', 'Time', 'PG', 'Reference', 'Retailer', 'Retailer Mobile', 'Customer', 'Card', 'Amount', 'Charges', 'Partner Charges', 'Profit', 'Status', 'Credited', 'Closing Balance'],
      exportWidths: [0.35, 1.3, 1, 1.5, 1.1, 1, 1.1, 0.7, 0.85, 0.85, 0.95, 0.8, 0.8, 1.3, 1],
      exportAligns: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'left', 'left', 'right'],
      searchText: (r) => [r.payerName, r.cardNumber, r.pipeRefNumber],
      exportCellColor: (r, header) => (header === 'Profit' ? [56, 161, 105] : null),
    },
  } : {}),
});

// PG name with the gateway's reference number underneath — the same number the wallet
// ledger shows as that credit's UTR, so a link can be matched across both reports.
const PgCell = ({ r }) => (
  <div>
    <div style={{ fontWeight: 600 }}>{r.pgName}</div>
    <div style={{ color: '#9CA3AF', fontSize: 12 }}>{r.pipeRefNumber || '—'}</div>
  </div>
);

// Retailer name with their mobile number (the login id) underneath.
const RetailerCell = ({ name, mobile }) => (
  <div>
    <div style={{ fontWeight: 600 }}>{name || '—'}</div>
    <div style={{ color: '#9CA3AF', fontSize: 12 }}>{mobile || ''}</div>
  </div>
);

const StatusBadge = ({ status }) => {
  const good = status === 'SUCCESS' || status === 'APPROVED';
  return (
    <span
      style={{
        display: 'inline-block', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
        background: good ? '#E0F7EA' : status === 'PENDING' ? '#FFF5EB' : '#FFF5F5',
        color: good ? '#38A169' : status === 'PENDING' ? '#F26A1B' : '#E53E3E',
      }}
    >
      {status}
    </span>
  );
};

/** Reports menu ('menu' step), each report keyed by buildReports() above, sharing one date-ranged view with PDF/CSV export. */
const ReportsPage = ({ onNavigate, user, navParams }) => {
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';
  // Built once per role, not per render: a fresh object every render made `report` look new to
  // every effect that depends on it, which re-ran them endlessly (the customer list was being
  // refetched in a loop — thousands of requests).
  const REPORTS = useMemo(() => buildReports(isAdmin), [isAdmin]);
  // Opened from a row's Reports menu on the Customers page: every wallet-based report is
  // then that one customer's — their wallet instead of the signed-in user's.
  const scopedCustomer = navParams?.customer ?? null;

  // Admin's own "IMPS Report" tile deep-links straight into that report instead of
  // opening the generic menu first — everywhere else still starts at 'menu' as before.
  const [step, setStep] = useState(() => (navParams?.report && REPORTS[navParams.report] ? navParams.report : 'menu'));
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storeDetails, setStoreDetails] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Reports with needsCustomer (Admin Ledger) read one retailer's wallet, picked from this list.
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerWalletId, setCustomerWalletId] = useState('');

  const report = REPORTS[step];
  const needsCustomer = Boolean(report?.needsCustomer);

  // Narrows the rows already loaded — no extra request, every report offers it. A row
  // matches when the text is in any of its columns (what the exports carry, formatted as
  // shown) or in a report's extra searchable fields; the table and both exports use the
  // narrowed list, so what you export is what you are looking at.
  // The refresh column exists only for reports with a notion of "pending", and only while at
  // least one visible row is pending.
  const showRefresh = Boolean(report?.isPending) && rows.some((r) => report.isPending(r));
  const needle = query.trim().toLowerCase();
  const visibleRows = needle && report
    ? rows.filter((r) => [...report.exportRow(r), ...(report.searchText?.(r) ?? [])]
      .some((v) => String(v ?? '').toLowerCase().includes(needle)))
    : rows;

  // The login response doesn't carry STORE_ADDRESS, so the full customer record is
  // fetched once for the PDF header (store name, address, contact number).
  useEffect(() => {
    if (!user?.id) return;
    fetch(apiUrl(`/api/customers/${user.id}`))
      .then((res) => (res.ok ? res.json() : null))
      .then(setStoreDetails)
      .catch(() => setStoreDetails(null));
  }, [user]);

  // Reads the report's rows for the chosen filters. Used by Search (with a loading state) and by
  // a pending row's refresh button (silently, so the table does not blank out).
  const loadRows = useCallback(() => {
    const walletId = scopedCustomer ? scopedCustomer.walletId : report.needsCustomer ? customerWalletId : report.resolveWalletId ? report.resolveWalletId(user) : user.walletId;
    return fetch(report.fetchUrl({ clientId: MASTER_CLIENT_ID, walletId, fromDate, toDate, status: statusFilter }))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!report.clientDateFilter) return data;
        // Whole days, local time: from 00:00 of the first day to just before the day after the last.
        const start = new Date(`${fromDate}T00:00:00`).getTime();
        const end = new Date(`${toDate}T00:00:00`).getTime() + 86400000;
        return data.filter((r) => { const t = new Date(r.createdTime).getTime(); return t >= start && t < end; });
      });
  }, [user, fromDate, toDate, report, statusFilter, customerWalletId, scopedCustomer]);

  const fetchReport = useCallback(() => {
    // Admin IMPS Report is client-wide, not scoped to the logged-in admin's own
    // wallet — the only report that doesn't need a walletId to make sense at all.
    if (!report || (!report.noWalletRequired && !scopedCustomer && !user?.walletId)) return;
    if (report.needsCustomer && !customerWalletId) return;
    setLoading(true);
    setError(null);
    loadRows()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, report, customerWalletId, scopedCustomer, loadRows]);

  // A pending row's refresh: ask the bank about that one payment (report.checkRow), re-read the
  // report in case the server has moved on, and say what the bank answered. The server's report
  // can lag behind the bank (a payment the bank has declined may still read PENDING there), so
  // when the bank has given a final answer and the row is still PENDING, the row shows that
  // answer instead.
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshNote, setRefreshNote] = useState(null);
  const refreshRow = async (row) => {
    setRefreshingId(row.id);
    setRefreshNote(null);
    try {
      const check = await report.checkRow(row);
      const fresh = await loadRows();
      const decided = check?.outcome === 'success' || check?.outcome === 'failed';
      setRows(fresh.map((x) => (x.id === row.id && report.isPending(x) && decided
        ? { ...x, status: check.outcome.toUpperCase() }
        : x)));
      setRefreshNote(`#${row.id}: ${check?.message ?? 'Checked.'}${check?.outcome === 'success' && check.utr ? ` UTR ${check.utr}.` : ''}`);
    } catch (err) {
      setRefreshNote(`Couldn't refresh: ${err.message}`);
    } finally {
      setRefreshingId(null);
      setTimeout(() => setRefreshNote(null), 6000);
    }
  };

  useEffect(() => {
    if (report) fetchReport();
    // Only the initial load for a freshly opened report — changing the dates afterward
    // requires pressing Search, so this intentionally doesn't depend on fetchReport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (!needsCustomer) return;
    setCustomersLoading(true);
    fetch(apiUrl(`/api/customers/retailers?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => setCustomers([...list].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)))))
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
  }, [needsCustomer]);

  const openReport = (key) => {
    setCustomerWalletId('');
    setRows([]);
    setQuery('');
    setRefreshNote(null);
    setStatusFilter('');
    setError(null);
    setFromDate(todayIso());
    setToDate(todayIso());
    setStep(key);
  };

  // A real .xlsx workbook, not a CSV: Excel guesses the type of every CSV cell and turns a
  // digits-only one into a number (dropping leading zeros and all but 15 digits), which mangled
  // 21-digit references into 6.1E+19. In a workbook each cell has its own type, so references,
  // UTRs and account numbers stay exactly as they are. See utils/xlsx.js.
  const exportExcel = async () => {
    try {
      const bytes = await buildXlsx({
        sheetName: report.label,
        headers: report.exportHeaders,
        rows: visibleRows.map((r) => report.exportRow(r)),
      });
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${step}-report-${fromDate}-to-${toDate}.xlsx`;
      link.style.display = 'none';
      // Attached while clicked, and the address kept alive a moment: some browsers drop the
      // download if the link is detached or the address is revoked straight away.
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      window.alert(`Couldn't create the Excel file: ${err.message}`);
    }
  };

  const exportPdf = async () => {
    // PG Reports (admin view) has enough columns — Partner Charges and Profit on
    // top of the usual set — that portrait A4 crowds them into overlapping text.
    // Landscape gives ~50% more width instead of shrinking everything past legibility.
    const isWide = report.exportHeaders.length > 10;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: isWide ? 'landscape' : 'portrait' });
    const left = 40;
    const right = doc.internal.pageSize.getWidth() - 40;
    const pageHeight = doc.internal.pageSize.getHeight();

    // Columns are sized proportionally to exportWidths (e.g. "Time" gets more room
    // than "ID") instead of splitting the page evenly, which overflowed wide fields
    // like the full date/time string into the next column.
    const totalWidth = right - left;
    const weightSum = report.exportWidths.reduce((sum, w) => sum + w, 0);
    let cursor = left;
    const columns = report.exportHeaders.map((label, i) => {
      const width = (report.exportWidths[i] / weightSum) * totalWidth;
      const align = report.exportAligns[i];
      const x = align === 'right' ? cursor + width - 4 : cursor;
      cursor += width;
      return { label, x, align };
    });
    let y = 50;

    const drawHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(156, 163, 175);
      columns.forEach((c) => doc.text(c.label, c.x, y, { align: c.align }));
      y += 6;
      doc.setDrawColor(220, 224, 232);
      doc.line(left, y, right, y);
      y += 16;
    };

    // Store letterhead — logo on the left, store name/address/contact beside it.
    const logoDataUrl = await loadImageAsDataUrl(tamilPayLogo);
    const storeName = storeDetails?.STORE_NAME ?? user?.STORE_NAME ?? '';
    const storeAddress = storeDetails?.STORE_ADDRESS ?? '';
    const contact = storeDetails?.MOBILE_NUMBER ?? user?.MOBILE_NUMBER ?? '';
    const textLeft = logoDataUrl ? left + 72 : left;

    if (logoDataUrl) {
      const { width: naturalW, height: naturalH } = doc.getImageProperties(logoDataUrl);
      const logoScale = Math.min(64 / naturalW, 24 / naturalH);
      doc.addImage(logoDataUrl, 'PNG', left, y - 18, naturalW * logoScale, naturalH * logoScale);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(16, 42, 80);
    doc.text(storeName, textLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(124, 132, 145);
    doc.text(storeAddress, textLeft, y + 14);
    doc.text(contact, textLeft, y + 26);

    y += 46;
    doc.setDrawColor(220, 224, 232);
    doc.line(left, y, right, y);
    y += 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(16, 42, 80);
    doc.text(report.label, left, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(124, 132, 145);
    doc.text(`${fromDate} to ${toDate}`, left, y);
    if (scopedCustomer) {
      y += 14;
      doc.text(`Customer: ${scopedCustomer.name}`, left, y);
    }
    y += 26;

    drawHeader();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const r of visibleRows) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 50;
        drawHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }
      report.exportRow(r).forEach((value, i) => {
        const header = report.exportHeaders[i];
        const text = header === 'Time' ? compactDateTime(r.createdTime) : String(value);
        const color = report.exportCellColor?.(r, header) ?? [16, 42, 80];
        doc.setTextColor(...color);
        doc.text(text, columns[i].x, y, { align: columns[i].align });
      });
      y += 18;
    }

    doc.save(`${step}-report-${fromDate}-to-${toDate}.pdf`);
  };

  // One-page receipt for a single row: store letterhead, title, key/value lines. Print,
  // Download and Share all start from the same document.
  const buildReceipt = async (r) => {
    const { title, rows: lines, status } = report.receipt(r);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 50;
    const right = doc.internal.pageSize.getWidth() - 50;
    let y = 60;

    const logoDataUrl = await loadImageAsDataUrl(tamilPayLogo);
    const textLeft = logoDataUrl ? left + 72 : left;
    if (logoDataUrl) {
      const { width: w, height: h } = doc.getImageProperties(logoDataUrl);
      const scale = Math.min(64 / w, 24 / h);
      doc.addImage(logoDataUrl, 'PNG', left, y - 18, w * scale, h * scale);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(16, 42, 80);
    doc.text(storeDetails?.STORE_NAME ?? user?.STORE_NAME ?? '', textLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(124, 132, 145);
    doc.text(storeDetails?.STORE_ADDRESS ?? '', textLeft, y + 14);
    doc.text(storeDetails?.MOBILE_NUMBER ?? user?.MOBILE_NUMBER ?? '', textLeft, y + 26);
    y += 46;
    doc.setDrawColor(220, 224, 232);
    doc.line(left, y, right, y);
    y += 36;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(16, 42, 80);
    doc.text(title, left, y);
    y += 24;
    doc.setFontSize(11);
    doc.setTextColor(...(status === 'SUCCESS' ? [56, 161, 105] : status === 'PENDING' ? [242, 106, 27] : [229, 62, 62]));
    doc.text(String(status), left, y);
    y += 28;

    lines.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(124, 132, 145);
      doc.text(label, left, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 42, 80);
      // The PDF's built-in font has no ₹ glyph (it prints a stray "¹" and spaces out the digits),
      // so amounts are written as "Rs. 108.00" in the document.
      doc.text(String(value ?? '—').replace(/₹/g, 'Rs. '), right, y, { align: 'right' });
      y += 10;
      doc.setDrawColor(236, 239, 244);
      doc.line(left, y, right, y);
      y += 20;
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(156, 163, 175);
    doc.text(`Generated on ${new Date().toLocaleString()}`, left, y + 14);
    return { doc, title, fileName: `${step}-receipt-${lines[0][1]}.pdf` };
  };

  const printReceipt = async (r) => {
    const { doc } = await buildReceipt(r);
    doc.autoPrint();
    const win = window.open(doc.output('bloburl'), '_blank');
    if (!win) window.alert('Allow pop-ups for this site to print the receipt.');
  };

  const downloadReceipt = async (r) => {
    const { doc, fileName } = await buildReceipt(r);
    doc.save(fileName);
  };

  // Shares the PDF itself where the browser/OS allows file sharing (phones, some desktops);
  // otherwise shares the receipt as text, and as a last resort copies that text.
  const shareReceipt = async (r) => {
    const { doc, title, fileName } = await buildReceipt(r);
    const text = [title, ...report.receipt(r).rows.map(([k, v]) => `${k}: ${v ?? '—'}`)].join('\n');
    try {
      const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
      } else if (navigator.share) {
        await navigator.share({ title, text });
      } else {
        await navigator.clipboard.writeText(text);
        window.alert("Sharing isn't supported in this browser — the receipt details were copied to the clipboard.");
      }
    } catch (err) {
      // Cancelling the share sheet is not an error worth reporting.
      if (err?.name !== 'AbortError') window.alert(`Couldn't share the receipt: ${err.message}`);
    }
  };

  return (
    // An open report fills the whole content area (the table takes the leftover height and
    // scrolls inside it); the menu is short and just sizes to its tiles.
    <div
        className="theme-purple"
        style={{
          position: 'relative', minHeight: 'calc(100vh - var(--tp-bar, 92px))', overflow: 'hidden', background: 'transparent',
          ...(report ? { height: 'calc(100vh - var(--tp-bar, 92px))', display: 'flex', flexDirection: 'column' } : {}),
        }}
      >
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(var(--theme-accent-rgb),0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, padding: '14px clamp(16px, 3vw, 32px) 20px', ...(report ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}) }}>
        <button
          className="btn-ghost"
          onClick={() => (scopedCustomer ? onNavigate?.('customers') : step === 'menu' ? onNavigate?.('home') : setStep('menu'))}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
            cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
            fontSize: 14, padding: 0, marginBottom: 12,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {step === 'menu' && (
          <div>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(20px, 3vw, 26px)', color: 'var(--theme-heading)', margin: '0 0 4px' }}>
              Reports
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#7C8491', margin: '0 0 18px' }}>
              Pick a report, then choose a date range.
            </p>

            {/* Even grid of tiles that reflows with the screen width (see .rp-grid in index.css). */}
            <div className="rp-grid">
              {Object.entries(REPORTS).map(([key, r], i) => (
                <button
                  key={key}
                  type="button"
                  className={`rp-tile rp-tone-${i % 4}`}
                  style={{ '--i': i }}
                  onClick={() => openReport(key)}
                >
                  <span className="rp-tile-icon"><r.icon size={22} strokeWidth={2} /></span>
                  <span className="rp-tile-text">
                    <span className="rp-tile-title">{r.label}</span>
                    <span className="rp-tile-desc">{r.description}</span>
                  </span>
                  <ChevronRight className="rp-tile-arrow" size={18} />
                </button>
              ))}
            </div>
          </div>
        )}

        {report && (
          <div style={{ ...cardStyle, maxWidth: 'none', padding: '16px clamp(16px, 3vw, 24px)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--theme-heading)', margin: 0 }}>
                  {report.label}
                </h1>
                {scopedCustomer && (
                  <span
                    style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                      background: 'var(--theme-tint)', color: 'var(--theme-accent)',
                    }}
                  >
                    {scopedCustomer.name}
                  </span>
                )}
                {fromDate === todayIso() && toDate === todayIso() && (
                  <span
                    style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 10.5, fontWeight: 700,
                      letterSpacing: '0.5px', textTransform: 'uppercase', background: '#E0F7EA', color: '#38A169',
                    }}
                  >
                    Showing today's data
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="icon-btn-anim" onClick={exportPdf} disabled={visibleRows.length === 0} style={exportBtnStyle}>
                  <FileText size={14} /> Export PDF
                </button>
                <button type="button" className="icon-btn-anim" onClick={exportExcel} disabled={visibleRows.length === 0} style={exportBtnStyle}>
                  <FileSpreadsheet size={14} /> Export Excel
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              {report.needsCustomer && (
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '1.2px', color: '#7C8491', marginBottom: 4, textTransform: 'uppercase' }}>
                    Select Customer
                  </label>
                  <SearchSelect
                    options={customers.map((c) => ({ value: c.walletId, label: c.fullName, hint: c.storeName }))}
                    value={customerWalletId}
                    onChange={(id) => { setCustomerWalletId(id); setRows([]); }}
                    loading={customersLoading}
                    placeholder="Type a customer name or store"
                    emptyText="No customer matches."
                  />
                </div>
              )}
              <DateRangeFields fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
              {/* Reports whose API filters by status offer it here; applied on Search. */}
              {report.statusOptions && (
                <div>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 10, letterSpacing: '1.2px', color: '#7C8491', marginBottom: 4, textTransform: 'uppercase' }}>
                    Status
                  </label>
                  <select
                    className="form-input no-icon" value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: 13, height: 34, minWidth: 130 }}
                  >
                    <option value="">All</option>
                    {report.statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              )}
              <button type="button" onClick={fetchReport} className="signin-btn" style={{ width: 'auto', padding: '0 18px', height: 34, fontSize: 13 }}>
                Search
              </button>

              {/* Filters the rows already on screen, as you type — no request. */}
              <div style={{ position: 'relative', marginLeft: 'auto', flex: '0 1 300px', minWidth: 200 }}>
                <Search size={15} color="#8A93A4" style={{ position: 'absolute', left: 12, top: 10, pointerEvents: 'none' }} />
                <input
                  type="text" className="form-input no-icon" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search any column"
                  aria-label="Search any column"
                  style={{ padding: '8px 34px 8px 34px', fontSize: 13, height: 34, textAlign: 'left' }}
                />
                {query && (
                  <button
                    type="button" onClick={() => setQuery('')} aria-label="Clear search"
                    style={{ position: 'absolute', right: 6, top: 5, width: 24, height: 24, display: 'grid', placeItems: 'center', border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer' }}
                  >
                    <X size={14} color="#8A93A4" />
                  </button>
                )}
                </div>
            </div>

            {refreshNote && (
              <p role="status" style={{ margin: "0 0 10px", padding: "9px 12px", borderRadius: 10, background: "#FFF5EB", color: "#C24E0C", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, textAlign: "left" }}>
                {refreshNote}
              </p>
            )}
            {loading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>}
            {!loading && error && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load report: {error}</p>}
            {!loading && !error && rows.length === 0 && (
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>
                {report.needsCustomer && !customerWalletId ? 'Select a customer to view their ledger.' : 'No entries in this date range.'}
              </p>
            )}

            {!loading && !error && rows.length > 0 && visibleRows.length === 0 && (
              <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>
                No entries match “{query.trim()}”.
              </p>
            )}

            {!loading && !error && needle && visibleRows.length > 0 && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#7C8491', margin: '0 0 8px', textAlign: 'left' }}>
                Showing {visibleRows.length} of {rows.length}
              </p>
            )}

            {!loading && !error && visibleRows.length > 0 && (
              <div className="table-scroll" style={{ flex: 1, minHeight: 160, overflowY: 'auto' }}>
                <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left' }}>
                      {report.headers.map((h) => (
                        <th
                          key={h}
                          style={{
                            position: 'sticky', top: 0, zIndex: 1, background: '#F3F7FD',
                            padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase',
                            color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      {report.receipt && (
                        <th
                          style={{
                            position: 'sticky', top: 0, zIndex: 1, background: '#F3F7FD',
                            padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase',
                            color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap',
                          }}
                        >
                          Actions
                        </th>
                      )}
                      {showRefresh && (
                        <th
                          style={{
                            position: 'sticky', top: 0, zIndex: 1, background: '#F3F7FD',
                            padding: '8px 12px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase',
                            color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap',
                          }}
                        >
                          Refresh
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, i) => (
                      // r.id assumes camelCase — some rows (the raw-JSON Qr/* reports
                      // in particular) may not have one at all, which would otherwise
                      // give every row the same undefined key.
                      <tr key={r.id ?? i} style={{ borderTop: '1px solid rgba(var(--theme-heading-rgb),0.06)' }}>
                        {report.cells(r).map((cell, i) => (
                          <td key={i} style={{ padding: '6px 12px', color: '#4A5568', whiteSpace: 'nowrap' }}>
                            {cell}
                          </td>
                        ))}
                        {report.receipt && (
                          <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                            {[
                              ['Print receipt', Printer, printReceipt],
                              ['Download receipt', Download, downloadReceipt],
                              ['Share receipt', Share2, shareReceipt],
                            ].map(([label, Icon, action]) => (
                              <button
                                key={label} type="button" title={label} aria-label={label}
                                className="icon-btn-anim" onClick={() => action(r)}
                                style={{ background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.1)', borderRadius: 8, cursor: 'pointer', padding: 6, marginRight: 6, lineHeight: 0 }}
                              >
                                <Icon size={14} color="var(--theme-heading)" />
                              </button>
                            ))}
                          </td>
                        )}
                        {showRefresh && (
                          <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                            {/* Only a pending payment has anything left to check. */}
                            {report.isPending(r) && (
                              <button
                                type="button" title="Check this payment with the bank" aria-label={`Check payment ${r.id}`}
                                className="icon-btn-anim" onClick={() => refreshRow(r)} disabled={refreshingId === r.id}
                                style={{ background: '#FFF5EB', border: '1px solid #FBDDC8', borderRadius: 8, cursor: refreshingId === r.id ? 'default' : 'pointer', padding: 6, lineHeight: 0 }}
                              >
                                <RefreshCw size={14} color="#F26A1B" className={refreshingId === r.id ? 'pgs-spin' : ''} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
