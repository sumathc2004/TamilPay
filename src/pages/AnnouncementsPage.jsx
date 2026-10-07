import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Megaphone, Pencil, Plus } from 'lucide-react';
import { apiUrl } from '../utils/api';
import { fetchAllAnnouncements, formatAnnouncementTime } from '../utils/announcements';
import { fieldErrorStyle, labelStyle } from '../styles/formStyles';
import '../styles/announcements.css';

const heading = {
  display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px',
  fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--theme-heading)',
};

const EMPTY = { id: null, title: '', message: '', isActive: true };

/**
 * Admin > Announcements: write, edit, and switch announcements on or off. Customers see the
 * active ones (daily popup and the home banner). The remote has no delete, so "off" is how
 * an announcement is withdrawn.
 */
const AnnouncementsPage = ({ user, onNavigate }) => {
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(
    () => fetchAllAnnouncements()
      .then((list) => { setItems(list); setLoadError(null); })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  // Admin-only screen: anyone else who reaches the URL is sent home. Deferred one tick because on
  // a first load App's mount effect (which runs after this one) rewrites the address bar to the
  // page it started on, which would undo an immediate redirect.
  useEffect(() => {
    if (!user || isAdmin) return undefined;
    const timer = setTimeout(() => onNavigate?.('home'), 0);
    return () => clearTimeout(timer);
  }, [user, isAdmin, onNavigate]);

  if (!isAdmin) return null;

  const save = async (payload, id) => {
    const res = await fetch(apiUrl(id ? `/api/announcements/${id}` : '/api/announcements'), {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, text: data?.message || 'Saved.' };
    const firstValidation = data?.errors && Object.values(data.errors).flat()[0];
    return { ok: false, text: firstValidation ?? data?.message ?? `Failed (${res.status}).` };
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setStatus({ ok: false, text: 'Enter a title.' });
    if (!form.message.trim()) return setStatus({ ok: false, text: 'Enter the message.' });
    setBusy(true);
    setStatus(null);
    try {
      const result = await save({ title: form.title, message: form.message, isActive: form.isActive }, form.id);
      setStatus(result);
      if (result.ok) {
        setForm(EMPTY);
        await refresh();
      }
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a) => {
    setBusyId(a.id);
    setStatus(null);
    try {
      const result = await save({ title: a.title, message: a.message, isActive: !a.isActive }, a.id);
      setStatus(result);
      if (result.ok) await refresh();
    } catch (err) {
      setStatus({ ok: false, text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const editing = form.id != null;

  return (
    <div className="theme-purple" style={{ padding: '14px clamp(16px, 3vw, 32px) 28px' }}>
      <button
        type="button" className="btn-ghost" onClick={() => onNavigate?.('admin')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 12 }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 'clamp(20px, 3vw, 26px)', color: 'var(--theme-heading)', margin: '0 0 16px' }}>
        Announcements
      </h1>

      <div className="an-admin">
        <form className="an-card" onSubmit={submit} noValidate>
          <h2 style={heading}>
            {editing ? <Pencil size={18} color="var(--theme-accent)" /> : <Plus size={18} color="var(--theme-accent)" />}
            {editing ? 'Edit announcement' : 'New announcement'}
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Title</label>
            <input
              type="text" className="form-input no-icon" maxLength={100} placeholder="e.g. Service update"
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Message</label>
            <textarea
              className="form-input no-icon" rows={4} maxLength={500} placeholder="What should everyone know?"
              value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              style={{ height: 'auto', padding: '12px 14px', resize: 'vertical', fontFamily: 'Inter, sans-serif' }}
            />
            <div style={{ textAlign: 'right', fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{form.message.length}/500</div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#4A5568' }}>
            <input
              type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: '#0645C5' }}
            />
            Show to customers (active)
          </label>

          {status && (
            <p role="status" style={{ ...fieldErrorStyle, color: status.ok ? '#38A169' : '#E53E3E', fontSize: 13, margin: '0 0 12px' }}>{status.text}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="submit" className="signin-btn" disabled={busy} style={{ width: 'auto', padding: '0 22px', height: 40 }}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
            </button>
            {editing && (
              <button
                type="button" className="btn-ghost" onClick={() => { setForm(EMPTY); setStatus(null); }} disabled={busy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5 }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="an-card">
          <h2 style={heading}><Megaphone size={18} color="var(--theme-accent)" /> All announcements</h2>

          {loading && <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', margin: 0 }}>Loading…</p>}
          {!loading && loadError && <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E', margin: 0 }}>Couldn't load announcements: {loadError}</p>}
          {!loading && !loadError && items.length === 0 && (
            <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', margin: 0 }}>No announcements yet. Publish the first one.</p>
          )}

          {items.map((a, i) => (
            <div key={a.id ?? i} className={`an-row${a.isActive ? '' : ' an-row-off'}`} style={{ '--i': i }}>
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <h3 className="an-item-title">
                  {a.title}
                  <span className={`an-pill ${a.isActive ? 'on' : 'off'}`}>{a.isActive ? 'Active' : 'Off'}</span>
                </h3>
                <p className="an-item-msg">{a.message}</p>
                {a.createdTime && <time className="an-item-time">{formatAnnouncementTime(a.createdTime)}</time>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button" className="an-mini" disabled={busyId === a.id}
                  onClick={() => { setForm({ id: a.id, title: a.title, message: a.message, isActive: a.isActive }); setStatus(null); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }}
                >
                  Edit
                </button>
                <button type="button" className="an-mini" disabled={busyId === a.id} onClick={() => toggleActive(a)}>
                  {a.isActive ? 'Turn off' : 'Turn on'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsPage;
