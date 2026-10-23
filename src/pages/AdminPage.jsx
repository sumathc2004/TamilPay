import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, BookOpen, ChevronRight, ClipboardList, CreditCard, LayoutDashboard, Megaphone, Network, QrCode, Settings } from 'lucide-react';
import { apiUrl } from '../utils/api';
import DistributorsModal from '../components/DistributorsModal';
import BackButton from '../components/BackButton';

// Landing spot for admin-only tools. Customers navigates to its own page as
// before; Dashboard stays right here and renders its summary alongside the
// tiles instead of navigating away.
// Same tile style as the Reports menu (.rp-grid / .rp-tile in index.css).
const AdminPage = ({ onNavigate, onBack, walletVersion }) => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDistributors, setShowDistributors] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [explain, setExplain] = useState(null);
  const [explainError, setExplainError] = useState(null);

  // Re-fetches whenever the wallet changes elsewhere (e.g. Navbar's Add Credit),
  // since the dashboard's totals are derived from wallet balances.
  useEffect(() => {
    if (!showDashboard) return;
    fetch(apiUrl('/api/dashboard'))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then(setDashboard)
      .catch((err) => setDashboardError(err.message));

    // Why the wallet total and the pipe balance differ — what moved today.
    fetch(apiUrl('/api/dashboard/explain'))
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.detail ?? body?.message ?? `Request failed (${res.status})`);
        return body;
      })
      .then((data) => { setExplain(data); setExplainError(null); })
      .catch((err) => setExplainError(err.message));
  }, [showDashboard, walletVersion]);

  // The same tiles as before, grouped so each group has a heading and the page fills the screen.
  const groups = [
    {
      key: 'overview', Icon: LayoutDashboard, title: 'Overview & Reports', caption: 'Balances, and every retailer\'s reports in one place', tone: 0,
      items: [
        ['Dashboard', 'Wallet and payment pipe balances at a glance', LayoutDashboard, () => setShowDashboard(true)],
        ['Admin Ledger Report', "Any retailer's wallet ledger over a date range", BookOpen, () => onNavigate?.('reports', { report: 'adminLedger' })],
        ['Admin IMPS Report', "Every retailer's IMPS transfers, client-wide", ArrowLeftRight, () => onNavigate?.('reports', { report: 'adminImpsReport' })],
        ['Admin PG Report', "Every retailer's PG links, client-wide", CreditCard, () => onNavigate?.('reports', { report: 'adminPgReport' })],
        ['Admin QR Report', "Every retailer's QR collect requests, client-wide", QrCode, () => onNavigate?.('reports', { report: 'adminQrReport' })],
      ],
    },
    {
      key: 'qr', Icon: QrCode, title: 'QR', caption: 'Static QR codes and the requests made against them', tone: 1,
      items: [
        ['QR', 'Create and manage static QR codes', QrCode, () => onNavigate?.('qrCodes')],
        ['QR Requests', 'Approve or reject collect requests', ClipboardList, () => onNavigate?.('qrRequests')],
      ],
    },
    {
      key: 'manage', Icon: Settings, title: 'Manage', caption: 'What every customer sees, and who distributes', tone: 2,
      items: [
        ['Announcements', 'Post updates every customer sees', Megaphone, () => onNavigate?.('announcements')],
        ['Distributors', 'Add and manage distributors', Network, () => setShowDistributors(true)],
      ],
    },
  ];

  return (
    <div className="theme-purple" style={{ position: 'relative', minHeight: 'calc(100vh - var(--tp-bar, 92px))', overflow: 'hidden', background: 'transparent' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(var(--theme-accent-rgb),0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, boxSizing: 'border-box', minHeight: 'calc(100vh - var(--tp-bar, 92px))', display: 'flex', flexDirection: 'column', padding: '16px clamp(16px, 3vw, 40px) 20px' }}>
        {/* Back and the title share one line, so the tiles start higher and the page fits without scrolling. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <BackButton onClick={() => onBack?.('home')} />
          <div>
            <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.015em', color: 'var(--theme-heading)', margin: 0, lineHeight: 1.15 }}>
              Admin
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: '2px 0 0' }}>Reports, QR codes and the tools that run TamilPay</p>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 28 }}>
          {/* Tiles, in four groups that share the screen between them */}
          <div className={`ad-board${showDashboard ? ' is-split' : ''}`} style={{ flex: '1 1 520px', minWidth: 0 }}>
            {groups.map((group) => (
              <section key={group.key} className={`ad-panel ad-panel--${group.key}`}>
                <div className="ad-panel-head">
                  <span className="ad-panel-icon"><group.Icon size={19} strokeWidth={2.1} /></span>
                  <div className="ad-panel-text">
                    <h2 className="ad-panel-title">{group.title}</h2>
                    <p className="ad-panel-caption">{group.caption}</p>
                  </div>
                </div>
                <div className="ad-items" style={{ '--cols': group.items.length }}>
                  {group.items.map(([label, description, Icon, onClick], i) => (
                    <button key={label} type="button" className={`rp-tile rp-tone-${(i + group.tone) % 4}`} style={{ '--i': i + group.tone }} onClick={onClick}>
                      <span className="rp-tile-icon"><Icon size={22} strokeWidth={2} /></span>
                      <span className="rp-tile-text">
                        <span className="rp-tile-title">{label}</span>
                        <span className="rp-tile-desc">{description}</span>
                      </span>
                      <ChevronRight className="rp-tile-arrow" size={18} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Dashboard summary — appears on the far right once the Dashboard tile is clicked */}
          {showDashboard && (
            <div style={{ flex: '1 1 320px', maxWidth: 480, minWidth: 0 }}>
              <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--theme-heading)', margin: '0 0 16px' }}>
                Dashboard
              </h2>

              {!dashboard && !dashboardError && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>
              )}
              {dashboardError && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load dashboard: {dashboardError}</p>
              )}

              {dashboard && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                      ['Total Pipe Balance', dashboard.totalPipeBalance, 'var(--theme-heading)'],
                      ['Total Wallet Balance', dashboard.totalWalletBalance, 'var(--theme-heading)'],
                      ['Wallets', dashboard.walletCount, 'var(--theme-heading)', false],
                      ['Difference', dashboard.difference, dashboard.difference >= 0 ? '#38A169' : '#E53E3E'],
                    ].map(([label, value, color, isCurrency = true]) => (
                      <div
                        key={label}
                        style={{
                          background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
                          borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.06)',
                        }}
                      >
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700, margin: '0 0 6px' }}>
                          {label}
                        </p>
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 800, color, margin: 0 }}>
                          {isCurrency ? `₹${Number(value).toFixed(2)}` : value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Admin only (this whole panel is): the difference, and what moved today. */}
                  <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: '#7C8491', margin: '0 0 10px' }}>
                    Difference explained
                  </p>
                  {explainError && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#E53E3E', margin: '0 0 20px' }}>Couldn't load the explanation: {explainError}</p>
                  )}
                  {!explain && !explainError && (
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#7C8491', margin: '0 0 20px' }}>Loading…</p>
                  )}
                  {explain && (
                    <div style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(var(--theme-heading-rgb),0.06)', borderRadius: 16, padding: '14px 18px', margin: '0 0 20px', boxShadow: '0 2px 20px rgba(var(--theme-heading-rgb), 0.06)' }}>
                      {[
                        ['Wallet balance (' + explain.walletCount + ' wallets)', explain.walletBalance],
                        ['Pipe balance', explain.pipeBalance],
                        ['Difference', explain.difference, explain.difference >= 0 ? '#38A169' : '#E53E3E', true],
                      ].map(([label, value, color, strong]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: strong ? 800 : 600, color: color ?? 'var(--theme-heading)' }}>
                          <span>{label}</span><span>₹{Number(value).toFixed(2)}</span>
                        </div>
                      ))}
                      <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#9CA3AF', margin: '12px 0 4px', paddingTop: 10, borderTop: '1px solid rgba(var(--theme-heading-rgb),0.08)' }}>
                        Today
                      </p>
                      {[
                        ['Card payments credited', explain.today.pgCredit],
                        ['IMPS paid', explain.today.impsSuccess],
                        ['IMPS failed', explain.today.impsFailed],
                        ['IMPS refunded', explain.today.impsRefund],
                        ['IMPS pending', explain.today.impsPending],
                        ['Card bills paid', explain.today.bbpsSuccess],
                        ['Card bills failed', explain.today.bbpsFailed],
                        ['Card bills refunded', explain.today.bbpsRefund],
                        ['Verification charges', explain.today.verifyDebit],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#4A5568' }}>
                          <span>{label}</span><span style={{ fontWeight: 600 }}>₹{Number(value).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: '#7C8491', margin: '0 0 10px' }}>
                    Payment Pipes
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dashboard.pipeBalances.map((pipe) => (
                      <div
                        key={pipe.pipeName}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(var(--theme-heading-rgb),0.06)',
                          borderRadius: 14, padding: '12px 16px',
                        }}
                      >
                        <div>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13.5, color: 'var(--theme-heading)', margin: 0 }}>
                            {pipe.pipeName}
                          </p>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 0' }}>
                            {pipe.message}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--theme-heading)', margin: 0 }}>
                            ₹{Number(pipe.balance).toFixed(2)}
                          </p>
                          <span
                            style={{
                              display: 'inline-block', marginTop: 2, padding: '2px 8px', borderRadius: 8, fontSize: 10.5, fontWeight: 700,
                              textTransform: 'uppercase',
                              background: pipe.status === 'success' ? '#E0F7EA' : '#FFF5F5',
                              color: pipe.status === 'success' ? '#38A169' : '#E53E3E',
                            }}
                          >
                            {pipe.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {showDistributors && <DistributorsModal onClose={() => setShowDistributors(false)} onNavigate={onNavigate} />}
    </div>
  );
};

export default AdminPage;
