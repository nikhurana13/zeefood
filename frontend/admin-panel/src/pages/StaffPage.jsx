import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

const MOCK_STAFF = [
  { id: 's1', uid: 's1', email: 'chef@rest.com', name: 'Raj Kumar', restaurant_id: 'demo-restaurant-1',
    role: 'kitchen', permissions: { can_manage_orders: true, can_update_stock: true, can_add_items: false }, is_active: true },
  { id: 's2', uid: 's2', email: 'delivery@rest.com', name: 'Amit Singh', restaurant_id: 'demo-restaurant-1',
    role: 'delivery', permissions: { can_manage_orders: true, can_update_stock: false, can_add_items: false }, is_active: true },
  { id: 's3', uid: 's3', email: 'pantry@rest.com', name: 'Sunita Devi', restaurant_id: 'demo-restaurant-1',
    role: 'pantry', permissions: { can_manage_orders: true, can_update_stock: true, can_add_items: true }, is_active: false },
];

const ROLE_COLORS = { kitchen: 'badge-warning', delivery: 'badge-info', pantry: 'badge-primary', manager: 'badge-success' };

export default function StaffPage() {
  const [staff, setStaff] = useState(MOCK_STAFF);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'kitchen', restaurant_id: 'demo-restaurant-1' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.listStaff('demo-restaurant-1').then(data => { if (data.length) setStaff(data); }).catch(() => {});
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const newStaff = await api.createStaff(form);
      setStaff(prev => [...prev, newStaff]);
      setShowAdd(false);
    } catch (err) {
      alert(err.message);
    } finally { setAdding(false); }
  };

  const toggleActive = async (member) => {
    try {
      await api.updateStaff(member.id, { is_active: !member.is_active });
      setStaff(prev => prev.map(s => s.id === member.id ? { ...s, is_active: !s.is_active } : s));
    } catch (_) {}
  };

  const removeStaff = async (member) => {
    if (!confirm(`Remove ${member.name}?`)) return;
    try {
      await api.deleteStaff(member.id);
      setStaff(prev => prev.filter(s => s.id !== member.id));
    } catch (_) {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Staff Management</h1>
          <p className="text-muted text-sm">Manage staff accounts and permissions</p>
        </div>
        <button id="add-staff-btn" className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Staff
        </button>
      </div>

      {/* Staff Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {staff.map(member => (
          <div key={member.id} className="card" style={{ opacity: member.is_active ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700
              }}>{member.name[0]}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{member.name}</div>
                <div className="text-muted text-sm truncate">{member.email}</div>
              </div>
              <span className={`badge ${ROLE_COLORS[member.role] || 'badge-muted'}`}>{member.role}</span>
            </div>

            {/* Permissions */}
            <div style={{ marginBottom: 16 }}>
              <div className="text-xs text-muted" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Permissions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(member.permissions || {}).map(([key, val]) => (
                  <span key={key} className={`badge ${val ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                    {key.replace(/can_/,'').replace(/_/g,' ')}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                id={`toggle-staff-${member.id}`}
                className={`btn btn-ghost btn-sm`}
                onClick={() => toggleActive(member)}
                style={{ flex: 1 }}
              >
                {member.is_active ? '⏸ Deactivate' : '▶ Activate'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => removeStaff(member)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Add New Staff</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input id="staff-name" className="form-input" value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="Staff member name"/>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input id="staff-email" className="form-input" type="email" value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))} required placeholder="staff@restaurant.com"/>
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select id="staff-role" className="form-input" value={form.role}
                  onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                  <option value="kitchen">Kitchen Staff</option>
                  <option value="delivery">Delivery</option>
                  <option value="pantry">Pantry</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button id="submit-staff-btn" type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
