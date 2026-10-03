import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  TrendingUp,
} from 'lucide-react';
import Hero from '../components/Hero';
import { apiUrl } from '../utils/api';

const features = [
  { Icon: ShieldCheck, color: '#E53E3E', bg: '#FFF5F5', label: ['Secure', 'Transactions'] },
  { Icon: Zap,         color: '#13BFF3', bg: '#E6FAFE', label: ['Fast', 'Payments']       },
  { Icon: Users,       color: '#38A169', bg: '#F0FFF4', label: ['Trusted', 'by Millions'] },
  { Icon: TrendingUp,  color: '#0645C5', bg: '#EBF8FF', label: ['A Brighter', 'Tomorrow'] },
];

const LoginPage = ({ onLogin }) => {
  const [showPw,   setShowPw]   = useState(false);
  const [loginId,  setLoginId]  = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginId, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || 'Invalid login ID or password.');
        return;
      }
      onLogin?.(data);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-root">
      {/* ── Soft background diagonal swoosh connecting smoothly to hero ── */}
      <div
        className="auth-bg-swoosh"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '50%',
          height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(6,69,197,0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(222,235,253,0.45) 0%, rgba(196,222,250,0.2) 40%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Page content ── */}
      <div className="page-content">

        {/* ── LEFT: Login form ── */}
        <div className="login-form-panel">
          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1
              style={{
                fontFamily: 'Poppins, Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 'clamp(32px, 9vw, 44px)',
                lineHeight: 1.1,
                letterSpacing: '-0.5px',
              }}
            >
              <span style={{ color: '#172033' }}>Welcome </span>
              <span
                style={{
                  background: 'linear-gradient(90deg, #0645C5, #13BFF3)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Back
              </span>
            </h1>
            <p style={{ marginTop: 8, color: '#7C8491', fontSize: 15, fontFamily: 'Manrope, sans-serif' }}>
              Secure. Simple. Smarter Payments.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* LOGIN ID */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>LOGIN ID</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#B0B8C4" style={iconStyle} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="RKXXXXXXXXXXX"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#B0B8C4" style={iconStyle} />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', padding: 0,
                  }}
                >
                  {showPw ? <EyeOff size={17} color="#B0B8C4" /> : <Eye size={17} color="#B0B8C4" />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 22 }}>
              <a href="#" style={{ fontSize: 14, color: '#0645C5', fontFamily: 'Manrope, sans-serif', fontWeight: 500, textDecoration: 'none' }}>
                Forgot Password?
              </a>
            </div>

            {/* Error message */}
            {error && (
              <p style={{ color: '#E53E3E', fontSize: 13.5, fontFamily: 'Manrope, sans-serif', marginTop: -8, marginBottom: 16 }}>
                {error}
              </p>
            )}

            {/* Sign In button */}
            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? 'Signing In…' : 'Sign In'} {!loading && <ArrowRight size={18} strokeWidth={2.5} />}
            </button>
          </form>

          {/* Feature icons */}
          <div style={{ display: 'flex', gap: 16, marginTop: 36 }}>
            {features.map(({ Icon, color, bg, label }, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 13,
                  background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={22} color={color} strokeWidth={1.8} />
                </div>
                <span style={{ fontSize: 11, color: '#172033', fontFamily: 'Manrope, sans-serif', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                  {label[0]}<br />{label[1]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER + RIGHT: Hero (shared) ── */}
        <Hero />
      </div>
    </div>
  );
};

const labelStyle = {
  display: 'block',
  fontFamily: 'Manrope, sans-serif',
  fontWeight: 600,
  fontSize: 10.5,
  letterSpacing: '2px',
  color: '#7C8491',
  marginBottom: 7,
  textTransform: 'uppercase',
};

const iconStyle = {
  position: 'absolute',
  left: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
};

export default LoginPage;
