import React from 'react';
import { ArrowLeft, Ban } from 'lucide-react';

/** Shown in place of a page that has been switched off (see utils/disabledFeatures.js). */
const UnavailablePage = ({ onNavigate }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 16px' }}>
    <div style={{ maxWidth: 420, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <span style={{ display: 'inline-flex', width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#F3F7FD', color: '#7C8491', marginBottom: 14 }}>
        <Ban size={30} />
      </span>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Temporarily unavailable</h1>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.55 }}>
        This service is switched off right now. Your earlier payments are still in Reports.
      </p>
      <button type="button" className="signin-btn" onClick={() => onNavigate?.('home')} style={{ height: 42, padding: '0 20px' }}>
        <ArrowLeft size={16} /> Back to Home
      </button>
    </div>
  </div>
);

export default UnavailablePage;
