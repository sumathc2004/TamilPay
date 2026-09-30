import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PaymentCard from '../components/PaymentCard';
import { apiUrl } from '../utils/api';

// Landing spot for admin-only tools. Customers navigates to its own page as
// before; Dashboard stays right here and renders its summary alongside the
// tiles instead of navigating away.
const AdminPage = ({ onNavigate, walletVersion }) => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);

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
  }, [showDashboard, walletVersion]);

  return (
    <div className="theme-purple" style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', overflow: 'hidden', background: 'transparent' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(var(--theme-accent-rgb),0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, padding: '20px clamp(16px, 5vw, 80px)' }}>
        <button
          className="btn-ghost"
          onClick={() => onNavigate?.('home')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
            cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
            fontSize: 14, padding: 0, marginBottom: 20,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--theme-heading)', margin: '0 0 20px' }}>
          Admin
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 40 }}>
          {/* Tiles */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <PaymentCard type="customers" onClick={() => onNavigate?.('customers')} />
            <PaymentCard type="dashboard" onClick={() => setShowDashboard(true)} />
            <PaymentCard type="pgSettings" onClick={() => onNavigate?.('pgsettings')} />
            <PaymentCard type="impsReport" onClick={() => onNavigate?.('reports', { report: 'adminImpsReport' })} />
            <PaymentCard type="pgReport" onClick={() => onNavigate?.('reports', { report: 'adminPgReport' })} />
            <PaymentCard type="qr" onClick={() => onNavigate?.('qrCodes')} />
            <PaymentCard type="qrRequests" onClick={() => onNavigate?.('qrRequests')} />
          </div>

          {/* Dashboard summary — appears on the far right once the Dashboard tile is clicked */}
          {showDashboard && (
            <div style={{ flex: '1 1 320px', maxWidth: 480 }}>
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
    </div>
  );
};

export default AdminPage;
