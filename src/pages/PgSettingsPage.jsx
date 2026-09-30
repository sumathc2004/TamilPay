import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CreditCard, FolderTree, Pencil, Plus, RefreshCw, SlidersHorizontal, Trash2, User } from 'lucide-react';
import Modal from '../components/Modal';
import { labelStyle, fieldErrorStyle } from '../styles/formStyles';
import { apiUrl } from '../utils/api';

const cardStyle = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid rgba(1,87,111,0.06)',
  borderRadius: 20,
  boxShadow: '0 2px 20px rgba(13, 79, 176, 0.08)',
  padding: 'clamp(20px, 5vw, 28px) clamp(18px, 6vw, 32px)',
};

// Sidebar menu, plus what each section needs to talk to its own /api/pgsettings/{resource}
// endpoints. Groups and Categories share the exact same Insert/Update/Delete shape upstream
// (just a different name field), so both render through the one PgListSection below —
// add a new entry here (and, if it's a genuinely different shape, a new section component)
// to extend the menu further.
const SECTIONS = [
  {
    key: 'pgGroups', label: 'PG Groups', icon: SlidersHorizontal,
    resource: 'groups', nameField: 'groupName',
    itemLabel: 'PG Group', itemLabelPlural: 'PG Groups', hasLogoUrl: true,
  },
  {
    key: 'pgCategories', label: 'PG Categories', icon: FolderTree,
    resource: 'categories', nameField: 'categoryName',
    itemLabel: 'PG Category', itemLabelPlural: 'PG Categories', hasLogoUrl: false,
  },
  {
    key: 'paymentGateway', label: 'Payment Gateway', icon: CreditCard,
    resource: 'pgs', itemLabel: 'Payment Gateway', itemLabelPlural: 'Payment Gateways',
    isPaymentGateway: true,
  },
];

/** Generic list/Add/Edit/Delete for a PG settings resource (groups, categories, ...) —
 * all of them share the same SelectAll/Insert/Update/Delete shape upstream, just under a
 * different name field. */
const PgListSection = ({ clientId, resource, nameField, itemLabel, itemLabelPlural, icon: Icon, hasLogoUrl }) => {
  const emptyForm = { name: '', displayOrder: '', isActive: true, logoUrl: '' };

  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  // null = closed, {} = adding, { id, ... } = editing an existing item
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadItems = () => {
    setError(null);
    fetch(apiUrl(`/api/pgsettings/${resource}?clientId=${clientId}`))
      .then(async (res) => {
        if (!res.ok) {
          const problem = await res.json().catch(() => null);
          throw new Error(problem?.detail ?? problem?.message ?? `Request failed (${res.status}).`);
        }
        return res.json();
      })
      .then(setItems)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    setItems(null);
    if (clientId) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, resource]);

  const openAdd = () => {
    setForm(emptyForm);
    setFormError(null);
    setEditing({});
  };

  const openEdit = (item) => {
    setForm({
      name: item[nameField],
      displayOrder: String(item.displayOrder),
      isActive: item.isActive,
      logoUrl: item.logoUrl ?? '',
    });
    setFormError(null);
    setEditing(item);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.displayOrder) {
      setFormError(`Enter a name and display order.`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const isEdit = Boolean(editing?.id);
    const url = isEdit ? apiUrl(`/api/pgsettings/${resource}/${editing.id}`) : apiUrl(`/api/pgsettings/${resource}`);
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          [nameField]: form.name.trim(),
          displayOrder: Number(form.displayOrder),
          isActive: form.isActive,
          ...(hasLogoUrl ? { logoUrl: form.logoUrl } : {}),
        }),
      });

      if (res.ok) {
        setEditing(null);
        loadItems();
      } else {
        const problem = await res.json().catch(() => null);
        setFormError(problem?.detail ?? problem?.message ?? `Failed to save (${res.status}).`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item[nameField]}"?`)) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(apiUrl(`/api/pgsettings/${resource}/${item.id}?clientId=${clientId}`), { method: 'DELETE' });
      if (res.ok) {
        loadItems();
      } else {
        const problem = await res.json().catch(() => null);
        window.alert(problem?.detail ?? problem?.message ?? `Failed to delete (${res.status}).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 20, color: '#0D4FB0', margin: 0 }}>
          {itemLabelPlural}
        </h1>
        <button
          type="button"
          className="btn-primary"
          onClick={openAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#F26A1B', border: 'none',
            borderRadius: 10, color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
            fontSize: 13, padding: '9px 16px', cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {!items && !error && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load {itemLabelPlural.toLowerCase()}: {error}</p>
      )}
      {items && items.length === 0 && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No {itemLabelPlural.toLowerCase()} yet.</p>
      )}

      {items && items.length > 0 && (
        <div className="table-scroll" style={{ border: '1px solid rgba(1,87,111,0.08)', borderRadius: 16 }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr>
                {[itemLabel, 'Display Order', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase',
                      color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'left', background: '#F3F7FD',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        className="icon-badge-shine"
                        style={{
                          width: 32, height: 32, borderRadius: 10, background: '#FFF5EB',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >
                        <Icon size={15} color="#F26A1B" />
                      </div>
                      <span style={{ color: '#0D4FB0', fontWeight: 700, fontSize: 13.5 }}>{item[nameField]}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#4A5568', fontSize: 13, whiteSpace: 'nowrap' }}>{item.displayOrder}</td>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase',
                        background: item.isActive ? '#E0F7EA' : '#FFF5F5',
                        color: item.isActive ? '#38A169' : '#E53E3E',
                      }}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="icon-btn-anim"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item[nameField]}`}
                        style={{
                          width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(1,87,111,0.1)',
                          background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        <Pencil size={13} color="#0D4FB0" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-anim"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        aria-label={`Delete ${item[nameField]}`}
                        style={{
                          width: 30, height: 30, borderRadius: 9, border: '1px solid rgba(229,62,62,0.2)',
                          background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: deletingId === item.id ? 'default' : 'pointer', opacity: deletingId === item.id ? 0.5 : 1,
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={13} color="#E53E3E" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <Modal onClose={() => setEditing(null)} style={{ padding: 'clamp(20px, 5vw, 28px)', width: 380, maxWidth: '90vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0D4FB0', margin: '0 0 16px' }}>
            {editing.id ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{itemLabel} Name</label>
              <input
                className="form-input no-icon"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={`e.g. ${itemLabel === 'PG Group' ? 'Namma Group' : 'Education'}`}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Display Order</label>
              <input
                className="form-input no-icon"
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                placeholder="e.g. 1"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#0D4FB0' }}>Active</span>
            </label>

            {formError && <p style={fieldErrorStyle}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing(null)}
                style={{
                  flex: 1, background: 'none', border: '1px solid rgba(1,87,111,0.15)', borderRadius: 12,
                  padding: '12px 0', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
                style={{
                  flex: 1, background: '#F26A1B', border: 'none', borderRadius: 12,
                  padding: '12px 0', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
                  color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}
              >
                {submitting ? 'Saving…' : editing.id ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

/** Payment Gateway list/Add/Edit/Delete — unlike Groups/Categories, a PG references a
 * Group and a Category (dropdowns) and carries a Description, so it gets its own form
 * instead of going through the generic PgListSection. */
const CHARGE_TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Percentage' },
  { value: 'VALUE', label: 'Value' },
];

const emptySettlementForm = {
  settlementName: '', settlementDays: '', pgKey: '',
  partnerChargeType: 'PERCENT', partnerChargeValue: '', partnerMinCharge: '',
  chargeType: 'PERCENT', chargeValue: '', minCharge: '', isActive: true,
};

const settlementFieldStyle = { padding: '10px 14px', color: '#4A5568', fontSize: 13, whiteSpace: 'nowrap' };

const PaymentGatewaySection = ({ clientId }) => {
  const emptyForm = { groupId: '', categoryId: '', pgName: '', description: '', displayOrder: '', isActive: true };

  const [items, setItems] = useState(null);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // "Apply to Individual" — a small popover with a retailer picker, opened on click.
  const [showIndividualPicker, setShowIndividualPicker] = useState(false);
  const [retailers, setRetailers] = useState(null);
  const [retailersError, setRetailersError] = useState(null);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [applyingIndividual, setApplyingIndividual] = useState(false);
  const individualPickerRef = useRef(null);

  // null = closed, { pgId } = adding, { pgId, id } = editing an existing settlement
  const [settlementEditing, setSettlementEditing] = useState(null);
  const [settlementForm, setSettlementForm] = useState(emptySettlementForm);
  const [settlementFormError, setSettlementFormError] = useState(null);
  const [settlementSubmitting, setSettlementSubmitting] = useState(false);
  const [deletingSettlementId, setDeletingSettlementId] = useState(null);

  const loadAll = () => {
    setError(null);
    Promise.all([
      fetch(apiUrl(`/api/pgsettings/pgs?clientId=${clientId}`)),
      fetch(apiUrl(`/api/pgsettings/groups?clientId=${clientId}`)),
      fetch(apiUrl(`/api/pgsettings/categories?clientId=${clientId}`)),
    ])
      .then(async ([pgsRes, groupsRes, categoriesRes]) => {
        if (!pgsRes.ok) {
          const problem = await pgsRes.json().catch(() => null);
          throw new Error(problem?.detail ?? problem?.message ?? `Request failed (${pgsRes.status}).`);
        }
        const [pgs, groupList, categoryList] = await Promise.all([
          pgsRes.json(),
          groupsRes.ok ? groupsRes.json() : [],
          categoriesRes.ok ? categoriesRes.json() : [],
        ]);
        setItems(pgs);
        setGroups(groupList);
        setCategories(categoryList);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    setItems(null);
    if (clientId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const groupName = (id) => groups.find((g) => g.id === id)?.groupName ?? `#${id}`;
  const categoryName = (id) => categories.find((c) => c.id === id)?.categoryName ?? `#${id}`;

  // Pushes the current Group/Category/PG/Settlement setup out to every retailer wallet
  // on this client, so an edit made here (a new PG, a changed charge, ...) actually shows
  // up on their Home > Pay In > PG page instead of only reaching wallets whose mapping
  // already happens to include it.
  const handleApplyToAll = async () => {
    if (!window.confirm('Apply the current Payment Gateway setup to every retailer on this client?')) return;
    setSyncing(true);
    try {
      const res = await fetch(apiUrl(`/api/pgsettings/sync-to-retailers?clientId=${clientId}`), { method: 'POST' });
      if (res.ok) {
        window.alert('Applied to every retailer.');
      } else {
        const problem = await res.json().catch(() => null);
        window.alert(problem?.detail ?? problem?.message ?? `Failed to apply (${res.status}).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Same idea, scoped to one retailer's wallet — the picker only loads the retailer
  // list the first time it's opened, not on every click.
  const toggleIndividualPicker = () => {
    setShowIndividualPicker((open) => !open);
    if (!retailers && !retailersError) {
      fetch(apiUrl(`/api/customers/retailers?clientId=${clientId}`))
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
        .then(setRetailers)
        .catch((err) => setRetailersError(err.message));
    }
  };

  const handleApplyToIndividual = async () => {
    if (!selectedWalletId) return;
    setApplyingIndividual(true);
    try {
      const res = await fetch(
        apiUrl(`/api/pgsettings/apply-to-wallet?clientId=${clientId}&walletId=${selectedWalletId}`),
        { method: 'POST' },
      );
      if (res.ok) {
        window.alert('Applied to that retailer.');
        setShowIndividualPicker(false);
        setSelectedWalletId('');
      } else {
        const problem = await res.json().catch(() => null);
        window.alert(problem?.detail ?? problem?.message ?? `Failed to apply (${res.status}).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setApplyingIndividual(false);
    }
  };

  useEffect(() => {
    if (!showIndividualPicker) return;
    const closeIfOutside = (e) => {
      if (!individualPickerRef.current?.contains(e.target)) setShowIndividualPicker(false);
    };
    document.addEventListener('mousedown', closeIfOutside);
    return () => document.removeEventListener('mousedown', closeIfOutside);
  }, [showIndividualPicker]);

  const openAdd = () => {
    setForm(emptyForm);
    setFormError(null);
    setEditing({});
  };

  const openEdit = (item) => {
    setForm({
      groupId: String(item.groupId),
      categoryId: String(item.categoryId),
      pgName: item.pgName,
      description: item.description ?? '',
      displayOrder: String(item.displayOrder),
      isActive: item.isActive,
    });
    setFormError(null);
    setEditing(item);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pgName.trim() || !form.groupId || !form.categoryId || !form.displayOrder) {
      setFormError('Enter a name, group, category and display order.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const isEdit = Boolean(editing?.id);
    const url = isEdit ? apiUrl(`/api/pgsettings/pgs/${editing.id}`) : apiUrl('/api/pgsettings/pgs');
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          groupId: Number(form.groupId),
          categoryId: Number(form.categoryId),
          pgName: form.pgName.trim(),
          description: form.description.trim(),
          displayOrder: Number(form.displayOrder),
          isActive: form.isActive,
        }),
      });

      if (res.ok) {
        setEditing(null);
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        setFormError(problem?.detail ?? problem?.message ?? `Failed to save (${res.status}).`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.pgName}"?`)) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(apiUrl(`/api/pgsettings/pgs/${item.id}?clientId=${clientId}`), { method: 'DELETE' });
      if (res.ok) {
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        window.alert(problem?.detail ?? problem?.message ?? `Failed to delete (${res.status}).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const openAddSettlement = (pg) => {
    setSettlementForm(emptySettlementForm);
    setSettlementFormError(null);
    setSettlementEditing({ pgId: pg.id });
  };

  const openEditSettlement = (pg, s) => {
    setSettlementForm({
      settlementName: s.settlementName,
      settlementDays: String(s.settlementDays),
      pgKey: s.pgKey ?? '',
      partnerChargeType: s.partnerChargeType ?? 'PERCENT',
      partnerChargeValue: String(s.partnerChargeValue),
      partnerMinCharge: String(s.partnerMinCharge),
      chargeType: s.chargeType ?? 'PERCENT',
      chargeValue: String(s.chargeValue),
      minCharge: String(s.minCharge),
      isActive: s.isActive,
    });
    setSettlementFormError(null);
    setSettlementEditing({ pgId: pg.id, id: s.settlementId });
  };

  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    if (
      !settlementForm.settlementName.trim() || !settlementForm.settlementDays
      || settlementForm.partnerChargeValue === '' || settlementForm.partnerMinCharge === ''
      || settlementForm.chargeValue === '' || settlementForm.minCharge === ''
    ) {
      setSettlementFormError('Fill in all required fields.');
      return;
    }

    setSettlementSubmitting(true);
    setSettlementFormError(null);
    const isEdit = Boolean(settlementEditing?.id);
    const url = isEdit ? apiUrl(`/api/pgsettings/settlements/${settlementEditing.id}`) : apiUrl('/api/pgsettings/settlements');
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          pgId: settlementEditing.pgId,
          settlementName: settlementForm.settlementName.trim(),
          settlementDays: Number(settlementForm.settlementDays),
          pgKey: settlementForm.pgKey.trim(),
          partnerChargeType: settlementForm.partnerChargeType,
          partnerChargeValue: Number(settlementForm.partnerChargeValue),
          partnerMinCharge: Number(settlementForm.partnerMinCharge),
          chargeType: settlementForm.chargeType,
          chargeValue: Number(settlementForm.chargeValue),
          minCharge: Number(settlementForm.minCharge),
          isActive: settlementForm.isActive,
        }),
      });

      if (res.ok) {
        setSettlementEditing(null);
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        setSettlementFormError(problem?.detail ?? problem?.message ?? `Failed to save (${res.status}).`);
      }
    } catch (err) {
      setSettlementFormError(err.message);
    } finally {
      setSettlementSubmitting(false);
    }
  };

  const handleDeleteSettlement = async (s) => {
    if (!window.confirm(`Delete settlement "${s.settlementName}"?`)) return;
    setDeletingSettlementId(s.settlementId);
    try {
      const res = await fetch(apiUrl(`/api/pgsettings/settlements/${s.settlementId}?clientId=${clientId}`), { method: 'DELETE' });
      if (res.ok) {
        loadAll();
      } else {
        const problem = await res.json().catch(() => null);
        window.alert(problem?.detail ?? problem?.message ?? `Failed to delete (${res.status}).`);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeletingSettlementId(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 20, color: '#0D4FB0', margin: 0 }}>
          Payment Gateways
        </h1>
        <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className="icon-btn-anim"
          onClick={handleApplyToAll}
          disabled={syncing || !items?.length}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff',
            border: '1.5px solid #0D4FB0', borderRadius: 10, color: '#0D4FB0',
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, padding: '9px 16px',
            cursor: (syncing || !items?.length) ? 'default' : 'pointer', opacity: (syncing || !items?.length) ? 0.6 : 1,
          }}
        >
          <RefreshCw size={15} className={syncing ? 'spin' : ''} /> {syncing ? 'Applying…' : 'Apply to All'}
        </button>

        <div ref={individualPickerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="icon-btn-anim"
            onClick={toggleIndividualPicker}
            disabled={!items?.length}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff',
              border: '1.5px solid #0D4FB0', borderRadius: 10, color: '#0D4FB0',
              fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, padding: '9px 16px',
              cursor: !items?.length ? 'default' : 'pointer', opacity: !items?.length ? 0.6 : 1,
            }}
          >
            <User size={15} /> Apply to Individual
          </button>

          {showIndividualPicker && (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 260,
                background: '#ffffff', border: '1px solid #E5E9F0', borderRadius: 12,
                boxShadow: '0 8px 24px rgba(1,87,111,0.12)', padding: 14, zIndex: 30,
              }}
            >
              <label style={labelStyle}>Retailer</label>
              {!retailers && !retailersError && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', fontSize: 13, margin: 0 }}>Loading…</p>
              )}
              {retailersError && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E', fontSize: 12.5, margin: 0 }}>
                  Couldn't load retailers: {retailersError}
                </p>
              )}
              {retailers && retailers.length === 0 && (
                <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491', fontSize: 13, margin: 0 }}>
                  No retailers with a wallet yet.
                </p>
              )}
              {retailers && retailers.length > 0 && (
                <>
                  <select
                    className="form-input no-icon"
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    style={{ marginBottom: 12 }}
                  >
                    <option value="">Select a retailer…</option>
                    {retailers.map((r) => (
                      <option key={r.walletId} value={r.walletId}>
                        {r.fullName}{r.storeName ? ` — ${r.storeName}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="signin-btn"
                    onClick={handleApplyToIndividual}
                    disabled={!selectedWalletId || applyingIndividual}
                    style={{ width: '100%', padding: '0 16px', height: 36, fontSize: 13 }}
                  >
                    {applyingIndividual ? 'Applying…' : 'Apply'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button type="button" className="btn-primary" onClick={openAdd} disabled={!groups.length || !categories.length}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#F26A1B', border: 'none',
            borderRadius: 10, color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
            fontSize: 13, padding: '9px 16px', cursor: (!groups.length || !categories.length) ? 'default' : 'pointer',
            opacity: (!groups.length || !categories.length) ? 0.6 : 1,
          }}
        >
          <Plus size={16} /> Add
        </button>
        </div>
      </div>

      {!items && !error && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#E53E3E' }}>Couldn't load payment gateways: {error}</p>
      )}
      {items && items.length === 0 && !error && (groups.length === 0 || categories.length === 0) && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>
          Add at least one PG Group and PG Category first.
        </p>
      )}
      {items && items.length === 0 && groups.length > 0 && categories.length > 0 && (
        <p style={{ fontFamily: 'Inter, sans-serif', color: '#7C8491' }}>No payment gateways yet.</p>
      )}

      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map((pg) => (
            <div key={pg.id} style={{ border: '1px solid rgba(1,87,111,0.08)', borderRadius: 16, overflow: 'hidden' }}>
              {/* PG header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#F3F7FD' }}>
                <div
                  className="icon-badge-shine"
                  style={{
                    width: 36, height: 36, borderRadius: 11, background: '#FFF5EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <CreditCard size={17} color="#F26A1B" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14.5, color: '#0D4FB0', margin: 0 }}>
                    {pg.pgName}
                  </p>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: '#9CA3AF', margin: '2px 0 0' }}>
                    {groupName(pg.groupId)} · {categoryName(pg.categoryId)}{pg.description ? ` · ${pg.description}` : ''}
                  </p>
                </div>
                <span
                  style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase',
                    background: pg.isActive ? '#E0F7EA' : '#FFF5F5',
                    color: pg.isActive ? '#38A169' : '#E53E3E',
                  }}
                >
                  {pg.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  type="button"
                  className="icon-btn-anim"
                  onClick={() => openEdit(pg)}
                  aria-label={`Edit ${pg.pgName}`}
                  style={{
                    width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(1,87,111,0.1)',
                    background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <Pencil size={14} color="#0D4FB0" />
                </button>
                <button
                  type="button"
                  className="icon-btn-anim"
                  onClick={() => handleDelete(pg)}
                  disabled={deletingId === pg.id}
                  aria-label={`Delete ${pg.pgName}`}
                  style={{
                    width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(229,62,62,0.2)',
                    background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: deletingId === pg.id ? 'default' : 'pointer', opacity: deletingId === pg.id ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} color="#E53E3E" />
                </button>
              </div>

              {/* Settlements — one full table row per settlement, no wrapping (scrolls instead) */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '1px',
                      textTransform: 'uppercase', color: '#7C8491',
                    }}
                  >
                    Settlements
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => openAddSettlement(pg)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, background: '#0D4FB0', border: 'none',
                      borderRadius: 9, color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                      fontSize: 12, padding: '6px 12px', cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} /> Add Settlement
                  </button>
                </div>

                {pg.settlements && pg.settlements.length > 0 ? (
                  <div className="table-scroll" style={{ border: '1px solid rgba(1,87,111,0.06)', borderRadius: 12 }}>
                    <table style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
                      <thead>
                        <tr>
                          {[
                            'Settlement Name', 'Days', 'PG Key', 'Partner Type', 'Partner Value',
                            'Partner Min', 'Charge Type', 'Charge Value', 'Min Charge', 'Status', 'Actions',
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: '10px 14px', fontSize: 10.5, letterSpacing: '0.8px', textTransform: 'uppercase',
                                color: '#7C8491', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'left', background: '#F3F7FD',
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pg.settlements.map((s) => (
                          <tr key={s.settlementId} style={{ borderTop: '1px solid rgba(1,87,111,0.06)' }}>
                            <td style={{ ...settlementFieldStyle, color: '#0D4FB0', fontWeight: 700 }}>{s.settlementName}</td>
                            <td style={settlementFieldStyle}>{s.settlementDays}</td>
                            <td style={settlementFieldStyle}>{s.pgKey || '—'}</td>
                            <td style={settlementFieldStyle}>{s.partnerChargeType}</td>
                            <td style={settlementFieldStyle}>{s.partnerChargeValue}</td>
                            <td style={settlementFieldStyle}>{s.partnerMinCharge}</td>
                            <td style={settlementFieldStyle}>{s.chargeType}</td>
                            <td style={settlementFieldStyle}>{s.chargeValue}</td>
                            <td style={settlementFieldStyle}>{s.minCharge}</td>
                            <td style={settlementFieldStyle}>
                              <span
                                style={{
                                  display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: s.isActive ? '#E0F7EA' : '#FFF5F5',
                                  color: s.isActive ? '#38A169' : '#E53E3E',
                                }}
                              >
                                {s.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={settlementFieldStyle}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  className="icon-btn-anim"
                                  onClick={() => openEditSettlement(pg, s)}
                                  aria-label={`Edit ${s.settlementName}`}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(1,87,111,0.1)',
                                    background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', flexShrink: 0,
                                  }}
                                >
                                  <Pencil size={12} color="#0D4FB0" />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn-anim"
                                  onClick={() => handleDeleteSettlement(s)}
                                  disabled={deletingSettlementId === s.settlementId}
                                  aria-label={`Delete ${s.settlementName}`}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(229,62,62,0.2)',
                                    background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: deletingSettlementId === s.settlementId ? 'default' : 'pointer',
                                    opacity: deletingSettlementId === s.settlementId ? 0.5 : 1,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Trash2 size={12} color="#E53E3E" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ fontFamily: 'Inter, sans-serif', color: '#9CA3AF', fontSize: 13, margin: 0 }}>No settlements yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <Modal onClose={() => setEditing(null)} style={{ padding: 'clamp(20px, 5vw, 28px)', width: 380, maxWidth: '90vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0D4FB0', margin: '0 0 16px' }}>
            {editing.id ? 'Edit Payment Gateway' : 'Add Payment Gateway'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>PG Name</label>
              <input
                className="form-input no-icon"
                value={form.pgName}
                onChange={(e) => setForm((f) => ({ ...f, pgName: e.target.value }))}
                placeholder="e.g. Namma Education PG"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Group</label>
                <select
                  className="form-input no-icon"
                  value={form.groupId}
                  onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.groupName}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Category</label>
                <select
                  className="form-input no-icon"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.categoryName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <input
                className="form-input no-icon"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Education collections"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Display Order</label>
              <input
                className="form-input no-icon"
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: e.target.value }))}
                placeholder="e.g. 1"
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#0D4FB0' }}>Active</span>
            </label>

            {formError && <p style={fieldErrorStyle}>{formError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing(null)}
                style={{
                  flex: 1, background: 'none', border: '1px solid rgba(1,87,111,0.15)', borderRadius: 12,
                  padding: '12px 0', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
                style={{
                  flex: 1, background: '#F26A1B', border: 'none', borderRadius: 12,
                  padding: '12px 0', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
                  color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}
              >
                {submitting ? 'Saving…' : editing.id ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {settlementEditing !== null && (
        <Modal onClose={() => setSettlementEditing(null)} style={{ padding: 'clamp(20px, 5vw, 28px)', width: 540, maxWidth: '94vw' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#0D4FB0', margin: '0 0 16px' }}>
            {settlementEditing.id ? 'Edit Settlement' : 'Add Settlement'}
          </h2>

          <form onSubmit={handleSettlementSubmit}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 220px' }}>
                <label style={labelStyle}>Settlement Name</label>
                <input
                  className="form-input no-icon"
                  value={settlementForm.settlementName}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, settlementName: e.target.value }))}
                  placeholder="e.g. T+0 Instant"
                />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>Days</label>
                <input
                  className="form-input no-icon"
                  type="number"
                  value={settlementForm.settlementDays}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, settlementDays: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>PG Key</label>
              <input
                className="form-input no-icon"
                value={settlementForm.pgKey}
                onChange={(e) => setSettlementForm((f) => ({ ...f, pgKey: e.target.value }))}
                placeholder="e.g. NAMMA-EDU-T0-KEY"
              />
            </div>

            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#7C8491', margin: '0 0 10px' }}>
              Partner Charge
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 130px' }}>
                <label style={labelStyle}>Type</label>
                <select
                  className="form-input no-icon"
                  value={settlementForm.partnerChargeType}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, partnerChargeType: e.target.value }))}
                >
                  {CHARGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={labelStyle}>Value</label>
                <input
                  className="form-input no-icon"
                  type="number" step="any"
                  value={settlementForm.partnerChargeValue}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, partnerChargeValue: e.target.value }))}
                  placeholder="e.g. 0.002"
                />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={labelStyle}>Min Charge</label>
                <input
                  className="form-input no-icon"
                  type="number" step="any"
                  value={settlementForm.partnerMinCharge}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, partnerMinCharge: e.target.value }))}
                  placeholder="e.g. 8"
                />
              </div>
            </div>

            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: '#7C8491', margin: '0 0 10px' }}>
              Client Charge
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 130px' }}>
                <label style={labelStyle}>Type</label>
                <select
                  className="form-input no-icon"
                  value={settlementForm.chargeType}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, chargeType: e.target.value }))}
                >
                  {CHARGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={labelStyle}>Value</label>
                <input
                  className="form-input no-icon"
                  type="number" step="any"
                  value={settlementForm.chargeValue}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, chargeValue: e.target.value }))}
                  placeholder="e.g. 0.003"
                />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={labelStyle}>Min Charge</label>
                <input
                  className="form-input no-icon"
                  type="number" step="any"
                  value={settlementForm.minCharge}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, minCharge: e.target.value }))}
                  placeholder="e.g. 12"
                />
              </div>
            </div>

            {settlementEditing.id && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settlementForm.isActive}
                  onChange={(e) => setSettlementForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: '#0D4FB0' }}>Active</span>
              </label>
            )}

            {settlementFormError && <p style={fieldErrorStyle}>{settlementFormError}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSettlementEditing(null)}
                style={{
                  flex: 1, background: 'none', border: '1px solid rgba(1,87,111,0.15)', borderRadius: 12,
                  padding: '12px 0', cursor: 'pointer', color: '#7C8491', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={settlementSubmitting}
                style={{
                  flex: 1, background: '#F26A1B', border: 'none', borderRadius: 12,
                  padding: '12px 0', cursor: settlementSubmitting ? 'default' : 'pointer', opacity: settlementSubmitting ? 0.7 : 1,
                  color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 700,
                }}
              >
                {settlementSubmitting ? 'Saving…' : settlementEditing.id ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

/** Admin > PG Settings — sidebar menu shell. Sections get added to SECTIONS above as
 * they're built; the shell itself doesn't need to change. */
const PgSettingsPage = ({ onNavigate, user }) => {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].key);
  const active = SECTIONS.find((s) => s.key === activeSection);

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(ellipse at 10% 20%, rgba(255,122,0,0.06) 0%, transparent 60%), linear-gradient(135deg, rgba(255,235,225,0.45) 0%, rgba(255,215,200,0.2) 40%, transparent 75%)',
          pointerEvents: 'none', zIndex: 0,
        }}
      />

      {/* No padding/gap here — the sidebar sits flush against the navbar and the left
          edge, like a persistent nav rail rather than a floating card. There is only one
          scrollbar on this page — the normal page/document one. The sidebar just uses
          position: sticky to stay put within view as that single scrollbar moves, instead
          of being wrapped in its own separate scroll container (which produced a second,
          redundant scrollbar alongside the page's). */}
      <div className="sidebar-shell-row" style={{ position: 'relative', zIndex: 2, minHeight: 'calc(100vh - 64px)' }}>
        {/* Sidebar menu — sticky under the navbar, flush left, square corners */}
        <div
          className="sidebar-shell-sidebar"
          style={{
            background: '#0D4FB0',
            padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4,
            position: 'sticky', top: 64, alignSelf: 'flex-start',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15, color: '#ffffff',
              margin: '4px 0 12px', padding: '0 4px',
            }}
          >
            PG Settings
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '0 0 8px' }} />

          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={activeSection === s.key ? 'sidebar-menu-item sidebar-menu-item--active' : 'sidebar-menu-item'}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12,
                border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                color: '#ffffff', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5,
              }}
            >
              <s.icon size={17} />
              {s.label}
            </button>
          ))}

          <div style={{ flex: 1, minHeight: 12 }} />
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '4px 0 8px' }} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onNavigate?.('admin')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12,
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5,
            }}
          >
            <ArrowLeft size={17} />
            Back to Admin
          </button>
        </div>

        {/* Content area keeps its own padding, separate from the flush sidebar. */}
        <div style={{ flex: 1, padding: '20px clamp(16px, 4vw, 40px)', minWidth: 0 }}>
          <div style={{ ...cardStyle, maxWidth: active?.isPaymentGateway ? 1180 : 640 }}>
            {active?.isPaymentGateway && (
              <PaymentGatewaySection key={active.key} clientId={user?.Client_ID} />
            )}
            {active && !active.isPaymentGateway && (
              <PgListSection
                key={active.key}
                clientId={user?.Client_ID}
                resource={active.resource}
                nameField={active.nameField}
                itemLabel={active.itemLabel}
                itemLabelPlural={active.itemLabelPlural}
                icon={active.icon}
                hasLogoUrl={active.hasLogoUrl}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PgSettingsPage;
