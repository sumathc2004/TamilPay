import React from 'react';
import {
  ArrowLeftRight, ClipboardList, CreditCard, FileText, Landmark, LayoutDashboard, QrCode,
  Receipt, ScanLine, Settings, SlidersHorizontal, Smartphone, Tv, Users, Zap,
} from 'lucide-react';

const CARD_CONTENT = {
  pg: { Icon: CreditCard, label: 'PG' },
  dynamicQr: { Icon: ScanLine, label: 'Dynamic QR' },
  staticQr: { Icon: QrCode, label: 'Static QR' },
  prepaid: { Icon: Smartphone, label: 'Prepaid' },
  dth: { Icon: Tv, label: 'DTH' },
  loan: { Icon: Landmark, label: 'Loan' },
  electricity: { Icon: Zap, label: 'Electricity' },
  imps: { Icon: ArrowLeftRight, label: 'IMPS' },
  billPayments: { Icon: Receipt, label: 'Bill Payments' },
  report: { Icon: FileText, label: 'Report' },
  admin: { Icon: Settings, label: 'Admin' },
  customers: { Icon: Users, label: 'Customers' },
  dashboard: { Icon: LayoutDashboard, label: 'Dashboard' },
  pgSettings: { Icon: SlidersHorizontal, label: 'PG Settings' },
  impsReport: { Icon: ArrowLeftRight, label: 'IMPS Report' },
  pgReport: { Icon: CreditCard, label: 'PG Report' },
  qr: { Icon: QrCode, label: 'QR' },
  qrRequests: { Icon: ClipboardList, label: 'QR Requests' },
};

// onClick is optional — tiles without one (PG, Dynamic/Static QR, Bill Payments,
// for now) render visible but inert: no pointer cursor, no hover/focus affordance,
// not tab-reachable.
// size="lg" is for pages with room to spare (e.g. AdminPage) — the default stays
// compact since the Home page's tiles need to fit several sections without scrolling.
const PaymentCard = ({ type = 'imps', onClick, size = 'md' }) => {
  const { Icon, label } = CARD_CONTENT[type];
  const clickable = Boolean(onClick);
  const isLarge = size === 'lg';

  return (
    <div
      className={`payment-card${isLarge ? ' payment-card--lg' : ''}${clickable ? '' : ' payment-card--inert'}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {/* Icon badge — logo-style mark, centered above the label */}
      <div className="card-icon-badge icon-badge-shine">
        <Icon size={isLarge ? 30 : 20} color="#ffffff" strokeWidth={2.25} />
      </div>

      {/* Label below the icon */}
      <span
        style={{
          fontFamily: 'Inter, Manrope, sans-serif',
          fontWeight: 700,
          fontSize: isLarge ? 'clamp(13px, 3.2vw, 17px)' : 'clamp(10px, 2.6vw, 12px)',
          color: '#0D4FB0',
          letterSpacing: '-0.1px',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default PaymentCard;
