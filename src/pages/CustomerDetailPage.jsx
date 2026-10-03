import React, { useEffect, useState } from 'react';
import { ArrowLeft, IdCard, MapPin, Pencil, Phone, Trash2, X } from 'lucide-react';
import { labelStyle, fieldErrorStyle } from '../styles/formStyles';
import { getCustomerId, MASTER_CLIENT_ID } from '../utils/customer';
import { apiUrl } from '../utils/api';
import Avatar from '../components/Avatar';
import ViewRow from '../components/ViewRow';
import Modal from '../components/Modal';

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_PATTERN = /^\d{12}$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

const EMPTY_FORM = {
  fullName: '',
  pan: '',
  aadhaar: '',
  dateOfBirth: '',
  mobileNumber: '',
  emailId: '',
  gst: '',
  residentialAddress: '',
  storeName: '',
  storeAddress: '',
  roleId: '',
};

const toFormValues = (c) => ({
  fullName: c.FULL_NAME ?? '',
  pan: c.PAN ?? '',
  aadhaar: c.ADHAAR ?? '',
  dateOfBirth: c.DATE_OF_BIRTH ?? '',
  mobileNumber: c.MOBILE_NUMBER ?? '',
  emailId: c.EMAIL_ID ?? '',
  gst: c.GST ?? '',
  residentialAddress: c.RESIDENTIAL_ADDRESS ?? '',
  storeName: c.STORE_NAME ?? '',
  storeAddress: c.STORE_ADDRESS ?? '',
  roleId: String(c.roleId ?? ''),
});

const SectionCard = ({ title, icon: Icon, children, style }) => (
  <div
    style={{
      background: '#ffffff',
      border: '1px solid rgba(1,87,111,0.08)',
      borderRadius: 16,
      padding: '20px 22px',
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <Icon size={14} color="#F26A1B" />
      <h3
        style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: 11.5,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: '#7C8491',
          margin: 0,
        }}
      >
        {title}
      </h3>
    </div>
    {children}
  </div>
);

const Field = ({ label, error, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={labelStyle}>{label}</label>
    {children}
    {error && <p style={fieldErrorStyle}>{error}</p>}
  </div>
);

const pageWrapStyle = {
  position: 'relative',
  minHeight: 'calc(100vh - 64px)',
  overflow: 'hidden',
  background: '#ffffff',
};

const backgroundSwooshStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(ellipse at 10% 20%, rgba(255,122,0,0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
  pointerEvents: 'none',
  zIndex: 0,
};

/**
 * A single customer's full detail page — view, edit, or create.
 * Backed entirely by the remote Client/Customer API (see backend CustomersController).
 * navParams: { customerId?, mode: 'view'|'edit'|'create' }.
 */
const CustomerDetailPage = ({ onNavigate, navParams }) => {
  const customerId = navParams?.customerId ?? null;
  const [mode, setMode] = useState(navParams?.mode ?? (customerId ? 'view' : 'create'));

  const [clients, setClients] = useState([]);
  const [roles, setRoles] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(!!customerId);
  const [customerError, setCustomerError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/clients'))
      .then((res) => (res.ok ? res.json() : []))
      .then(setClients)
      .catch(() => setClients([]));

    fetch(apiUrl('/api/roles'))
      .then((res) => (res.ok ? res.json() : []))
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (!customerId) return;

    fetch(apiUrl(`/api/customers/${customerId}`))
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setCustomer(data);
        if (navParams?.mode === 'edit') setForm(toFormValues(data));
      })
      .catch((err) => setCustomerError(err.message))
      .finally(() => setCustomerLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const clientLabel = (id) => {
    const match = clients.find((cl) => String(cl.id) === String(id));
    return match ? `${match.clientName} — ${match.firmName ?? match.clientCity}` : `#${id}`;
  };

  // PAN and GSTIN are always capitals — stored that way as you type, not just displayed that
  // way, because the format check below (and the server's) only accepts capital letters.
  const UPPERCASE_FIELDS = ['pan', 'gst'];
  const updateField = (name) => (e) => {
    const value = UPPERCASE_FIELDS.includes(name) ? e.target.value.toUpperCase() : e.target.value;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const updateMobile = (e) => {
    let digits = e.target.value.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    setForm((f) => ({ ...f, mobileNumber: digits.slice(0, 10) }));
  };

  const validate = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = 'Full name is required.';
    if (!PAN_PATTERN.test(form.pan.trim().toUpperCase())) errors.pan = 'Enter a valid PAN, e.g. AAAAA0000A.';
    if (!AADHAAR_PATTERN.test(form.aadhaar)) errors.aadhaar = 'Aadhaar must be exactly 12 digits.';
    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.';
    if (!INDIAN_MOBILE_PATTERN.test(form.mobileNumber)) errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number.';
    if (!form.emailId.trim()) errors.emailId = 'Email is required.';
    if (form.gst.trim() && !GSTIN_PATTERN.test(form.gst.trim().toUpperCase())) errors.gst = 'Enter a valid 15-character GSTIN.';
    if (!form.residentialAddress.trim()) errors.residentialAddress = 'Residential address is required.';
    if (!form.storeName.trim()) errors.storeName = 'Store name is required.';
    if (!form.storeAddress.trim()) errors.storeAddress = 'Store address is required.';
    return errors;
  };

  const handleEditClick = () => {
    setForm(toFormValues(customer));
    setFieldErrors({});
    setFormError(null);
    setMode('edit');
  };

  const handleCancel = () => {
    if (mode === 'create') {
      onNavigate('customers');
    } else {
      setMode('view');
    }
  };

  const handleSubmit = async (e) => {
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

    const payload = {
      clientId: MASTER_CLIENT_ID,
      fullName: form.fullName.trim(),
      pan: form.pan.trim().toUpperCase(),
      aadhaar: form.aadhaar.trim(),
      dateOfBirth: form.dateOfBirth,
      mobileNumber: form.mobileNumber.trim(),
      emailId: form.emailId.trim(),
      gst: form.gst.trim() ? form.gst.trim().toUpperCase() : null,
      residentialAddress: form.residentialAddress.trim(),
      storeName: form.storeName.trim(),
      storeAddress: form.storeAddress.trim(),
      roleId: form.roleId ? Number(form.roleId) : null,
    };

    const isEdit = mode === 'edit';
    const url = apiUrl(isEdit ? `/api/customers/${customerId}` : '/api/customers');
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 200 || res.status === 201) {
        onNavigate('customers');
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
      } else if (res.status === 404) {
        setFormError('This customer no longer exists.');
      } else {
        setFormError(`Save failed (${res.status}).`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(apiUrl(`/api/customers/${customerId}`), { method: 'DELETE' });
      if (res.status === 204 || res.status === 404) {
        onNavigate('customers');
        return;
      }
      setDeleteError(`Delete failed (${res.status}).`);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const backButton = (
    <button
      className="btn-ghost"
      onClick={() => onNavigate('customers')}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer',
        color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14, padding: 0, marginBottom: 20,
      }}
    >
      <ArrowLeft size={16} /> Back to Customers
    </button>
  );

  const isFormMode = mode === 'edit' || mode === 'create';

  return (
    <div style={pageWrapStyle}>
      <div style={backgroundSwooshStyle} />

      <div style={{ position: 'relative', zIndex: 2, padding: '28px clamp(16px, 5vw, 80px) 60px', maxWidth: 1000, margin: '0 auto' }}>
        {backButton}

        {!isFormMode && customerLoading && (
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading customer…</p>
        )}

        {!isFormMode && customerError && (
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load customer: {customerError}</p>
        )}

        {!isFormMode && customer && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <Avatar name={customer.FULL_NAME} size={56} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 24, color: '#0D4FB0', margin: 0 }}>
                  {customer.FULL_NAME}
                  {customer.roleName && (
                    <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 18 }}> ({customer.roleName})</span>
                  )}
                </h1>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#7C8491', margin: '3px 0 0' }}>
                  Customer #{getCustomerId(customer)} · {clientLabel(customer.Client_ID)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleEditClick}
                className="signin-btn"
                style={{ width: 'auto', padding: '0 22px', height: 42 }}
              >
                <Pencil size={15} /> Edit
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => { setDeleteError(null); setDeleting(true); }}
                style={{
                  background: 'none', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 12,
                  padding: '0 18px', height: 42, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                  color: '#E53E3E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>

            {/* Info cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
              <SectionCard title="Identity" icon={IdCard}>
                <ViewRow label="PAN" value={customer.PAN} />
                <ViewRow label="Aadhaar" value={customer.ADHAAR} />
                <ViewRow label="Date of Birth" value={customer.DATE_OF_BIRTH} />
              </SectionCard>

              <SectionCard title="Contact" icon={Phone}>
                <ViewRow label="Mobile Number" value={`+91 ${customer.MOBILE_NUMBER}`} />
                <ViewRow label="Email" value={customer.EMAIL_ID} />
              </SectionCard>
            </div>

            <SectionCard title="Store & Address" icon={MapPin} style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 16px' }}>
                <ViewRow label="Residential Address" value={customer.RESIDENTIAL_ADDRESS} />
                <ViewRow label="Store Name" value={customer.STORE_NAME} />
                <ViewRow label="Store Address" value={customer.STORE_ADDRESS} />
                <ViewRow label="GST" value={customer.GST} />
              </div>
            </SectionCard>
          </>
        )}

        {/* Add / Edit form */}
        {isFormMode && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 22, color: '#0D4FB0', margin: 0 }}>
                {mode === 'edit' ? 'Edit Customer' : 'New Customer'}
              </h1>
              <button
                type="button"
                className="icon-btn-anim"
                onClick={handleCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={20} color="#7C8491" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
              <SectionCard title="Identity" icon={IdCard}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 20px' }}>
                  <Field label="Full Name" error={fieldErrors.fullName}>
                    <input type="text" className="form-input no-icon" value={form.fullName} onChange={updateField('fullName')} required />
                  </Field>

                  <Field label="PAN" error={fieldErrors.pan}>
                    <input
                      type="text" className="form-input no-icon" placeholder="AAAAA0000A" maxLength={10}
                      style={{ textTransform: 'uppercase' }}
                      value={form.pan} onChange={updateField('pan')} required
                    />
                  </Field>

                  <Field label="Aadhaar" error={fieldErrors.aadhaar}>
                    <input
                      type="text" inputMode="numeric" className="form-input no-icon" placeholder="123412341234" maxLength={12}
                      value={form.aadhaar}
                      onChange={(e) => setForm((f) => ({ ...f, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                      required
                    />
                  </Field>

                  <Field label="Date of Birth" error={fieldErrors.dateOfBirth}>
                    <input type="date" className="form-input no-icon" value={form.dateOfBirth} onChange={updateField('dateOfBirth')} required />
                  </Field>

                  <Field label="Role">
                    <select className="form-input no-icon" value={form.roleId} onChange={updateField('roleId')}>
                      <option value="">Select role…</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.roleName}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </SectionCard>

              <SectionCard title="Contact" icon={Phone}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 20px' }}>
                  <Field label="Mobile Number" error={fieldErrors.mobileNumber}>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <span
                        style={{
                          display: 'flex', alignItems: 'center', padding: '0 12px', border: '1.5px solid #E5E8EE',
                          borderRight: 'none', borderRadius: '10px 0 0 10px', background: '#F3F7FD', color: '#4A5568',
                          fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 15,
                        }}
                      >
                        +91
                      </span>
                      <input
                        type="tel" inputMode="numeric" className="form-input no-icon"
                        style={{ borderRadius: '0 10px 10px 0' }}
                        placeholder="98765 43210" value={form.mobileNumber} onChange={updateMobile} required
                      />
                    </div>
                  </Field>

                  <Field label="Email" error={fieldErrors.emailId}>
                    <input type="email" className="form-input no-icon" value={form.emailId} onChange={updateField('emailId')} required />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard title="Store & Address" icon={MapPin}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 20px' }}>
                  <Field label="Residential Address" error={fieldErrors.residentialAddress}>
                    <input type="text" className="form-input no-icon" value={form.residentialAddress} onChange={updateField('residentialAddress')} required />
                  </Field>

                  <Field label="Store Name" error={fieldErrors.storeName}>
                    <input type="text" className="form-input no-icon" value={form.storeName} onChange={updateField('storeName')} required />
                  </Field>

                  <Field label="Store Address" error={fieldErrors.storeAddress}>
                    <input type="text" className="form-input no-icon" value={form.storeAddress} onChange={updateField('storeAddress')} required />
                  </Field>

                  <Field label="GST (optional)" error={fieldErrors.gst}>
                    <input
                      type="text" className="form-input no-icon" placeholder="29AAAAA0000A1Z5" maxLength={15}
                      style={{ textTransform: 'uppercase' }}
                      value={form.gst} onChange={updateField('gst')}
                    />
                  </Field>
                </div>
              </SectionCard>
            </div>

            {formError && <p style={{ ...fieldErrorStyle, marginTop: 16 }}>{formError}</p>}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button type="submit" className="signin-btn" style={{ width: 'auto', padding: '0 28px' }} disabled={submitting}>
                {submitting ? 'Saving…' : mode === 'edit' ? 'Update Customer' : 'Save Customer'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleCancel}
                style={{
                  background: 'none', border: '1px solid rgba(1,87,111,0.15)', borderRadius: 12, padding: '0 24px',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#4A5568', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleting && (
        <Modal onClose={() => !deleteBusy && setDeleting(false)} style={{ padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)', width: 420, maxWidth: '90vw' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={20} color="#E53E3E" />
            </div>
            <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0D4FB0', margin: 0 }}>Delete Customer</h2>
          </div>

          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14.5, color: '#4A5568', marginBottom: deleteError ? 8 : 24 }}>
            Are you sure you want to delete <strong>{customer?.FULL_NAME ?? 'this customer'}</strong>? This
            permanently removes the record and can't be undone.
          </p>

          {deleteError && <p style={{ ...fieldErrorStyle, marginBottom: 16 }}>{deleteError}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleDelete}
              disabled={deleteBusy}
              style={{
                background: '#E53E3E', color: '#ffffff', border: 'none', borderRadius: 12, padding: '12px 24px',
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                cursor: deleteBusy ? 'default' : 'pointer', opacity: deleteBusy ? 0.7 : 1,
              }}
            >
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDeleting(false)}
              disabled={deleteBusy}
              style={{
                background: 'none', border: '1px solid rgba(1,87,111,0.15)', borderRadius: 12, padding: '12px 24px',
                fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#4A5568', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CustomerDetailPage;
