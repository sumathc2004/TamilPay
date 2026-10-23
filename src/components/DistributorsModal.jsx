import React, { useEffect, useState } from 'react';
import { Network, X } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import { apiUrl } from '../utils/api';
import { MASTER_CLIENT_ID } from '../utils/customer';

const isDistributor = (c) => /^distributors?$/i.test((c.roleName || '').trim());

/**
 * Admin > Distributors: everyone on the client whose role is Distributors. They are kept out of
 * the Customers page, so this is where they are listed. Each one has a View mapping button, which
 * opens the page where their retailers are listed and more can be mapped.
 */
const DistributorsModal = ({ onClose, onNavigate }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(apiUrl(`/api/customers?clientId=${MASTER_CLIENT_ID}`))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then((list) => setRows(list.filter(isDistributor)))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Modal onClose={onClose} style={{ padding: 'clamp(20px, 5vw, 28px)', width: 480, maxWidth: '92vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 17, color: '#111827', margin: 0 }}>
          <Network size={18} color="#0D4FB0" /> Distributors
          {rows && <span style={{ fontSize: 12, fontWeight: 700, color: '#0D4FB0', background: '#E6EEFB', borderRadius: 999, padding: '2px 9px' }}>{rows.length}</span>}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}>
          <X size={18} color="#7C8491" />
        </button>
      </div>

      {!rows && !error && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', margin: 0 }}>Loading…</p>}
      {error && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E', margin: 0 }}>Couldn&apos;t load distributors: {error}</p>}

      {rows && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '18px 0 6px', fontFamily: 'Inter, sans-serif' }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: '0 0 6px' }}>No distributors yet</p>
          <p style={{ fontSize: 13, color: '#8A93A4', margin: 0, lineHeight: 1.55 }}>
            Anyone given the Distributors role will be listed here, not under Customers.
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
          {rows.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.08)', borderRadius: 12, padding: '10px 14px', fontFamily: 'Inter, sans-serif' }}>
              <Avatar name={c.FULL_NAME} size={36} />
              <div style={{ minWidth: 0, flex: '1 1 140px' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#0D4FB0' }}>{c.FULL_NAME}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#6B7280' }}>+91 {c.MOBILE_NUMBER}{c.STORE_NAME ? ` · ${c.STORE_NAME}` : ''}</p>
              </div>
              {c.username ? (
                <button
                  type="button" className="cu-chip-btn cu-chip-btn--blue"
                  onClick={() => { onClose(); onNavigate?.('distributorMapping', { customerId: c.id, from: 'admin' }); }}
                >
                  <Network size={13} /> View mapping
                </button>
              ) : (
                <span style={{ fontSize: 12, color: '#8A93A4' }} title="A wallet has to be added first">No wallet yet</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default DistributorsModal;
