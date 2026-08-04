import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import './index.css';

// ── Theme Hook ─────────────────────────────────
function useStaffTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('zf_staff_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zf_staff_theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const RESTAURANT_ID = 'demo-restaurant-1';

// ── API util ──────────────────────────────────────────────
const getToken = () => localStorage.getItem('zefood_staff_token');
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers }
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'API Error');
  return res.json();
}

// ── Mock Data ─────────────────────────────────────────────
const MOCK_ORDERS = [
  { id: 'ORD-101', type: 'delivery', items: [{ name: 'Butter Chicken', quantity: 2 }, { name: 'Naan', quantity: 4 }], status: 'placed', total_amount: 720, created_at: new Date(Date.now()-120000).toISOString() },
  { id: 'ORD-102', type: 'room_service', items: [{ name: 'Club Sandwich', quantity: 1 }], status: 'preparing', total_amount: 320, created_at: new Date(Date.now()-600000).toISOString(), room_number: '204' },
  { id: 'ORD-103', type: 'delivery', items: [{ name: 'Paneer Tikka', quantity: 1 }, { name: 'Garlic Naan', quantity: 2 }], status: 'ready', total_amount: 480, created_at: new Date(Date.now()-300000).toISOString() },
];

const MOCK_ITEMS = [
  { id: 'i1', name: 'Butter Chicken', category: 'Main Course', price: 280, is_available: true, stock: 18 },
  { id: 'i2', name: 'Paneer Tikka', category: 'Starters', price: 350, is_available: true, stock: 12 },
  { id: 'i3', name: 'Dal Makhani', category: 'Main Course', price: 180, is_available: false, stock: 0 },
  { id: 'i4', name: 'Garlic Naan', category: 'Bread', price: 45, is_available: true, stock: 50 },
];

const MOCK_ALERTS = [
  { id: 'a1', message: '⚡ High order volume expected at 1:00 PM. Consider prepping extra servings.', type: 'demand_spike', created_at: new Date().toISOString(), read: false },
  { id: 'a2', message: '📦 Stock for Dal Makhani is critically low (0 units). Restock soon.', type: 'low_stock', created_at: new Date(Date.now()-3600000).toISOString(), read: false },
];

const STATUS_COLORS = { placed: 'badge-new', preparing: 'badge-preparing', ready: 'badge-ready', out_for_delivery: 'badge-ready', delivered: 'badge-delivered', cancelled: 'badge-cancelled' };
const NEXT_STATUS = { placed: 'preparing', preparing: 'ready', ready: 'out_for_delivery' };

// ── Login ─────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); try { await onLogin(email, password); } catch(err){ toast.error(err.message); } finally { setLoading(false); }};
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 40% 50%, rgba(255,120,50,0.06) 0%, transparent 60%), var(--bg-primary)' }}>
      <div style={{ width: 380, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍🍳</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>ZEfood</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Staff Portal</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Email</label>
            <input id="staff-email" className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@kitchen.com" required/>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Password</label>
            <input id="staff-password" className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/>
          </div>
          <button id="staff-login-btn" className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In to Staff Portal'}</button>
        </form>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────
function StaffSidebar({ alertCount, orderCount, theme, toggleTheme }) {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('zefood_staff_token'); localStorage.removeItem('zefood_staff_user'); window.location.reload(); };
  const user = JSON.parse(localStorage.getItem('zefood_staff_user') || '{}');
  return (
    <aside className="staff-sidebar">
      <div className="sidebar-logo">
        <span style={{ fontSize: 22 }}>👨‍🍳</span>
        <div style={{ marginLeft: 8 }}>
          <div className="logo-text">ZEfood</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-body)' }}>Staff Panel</div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {[
          { to: '/', icon: '📋', label: 'Order Queue', count: orderCount },
          { to: '/inventory', icon: '🍽️', label: 'Inventory' },
          { to: '/alerts', icon: '🔔', label: 'Alerts', count: alertCount },
        ].map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span>{item.icon}</span> {item.label}
            {item.count > 0 && <span style={{ marginLeft: 'auto', background: 'var(--primary)', color: 'white', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>{item.count}</span>}
          </NavLink>
        ))}
      </nav>
      {/* Theme Toggle */}
      <div className="theme-toggle-bar">
        <button id="staff-theme-toggle" className="theme-toggle-btn" onClick={toggleTheme}>
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
      <div style={{ padding: 16, borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>{user.name || 'Staff Member'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'capitalize' }}>{user.role || 'kitchen'}</div>
        <button className="btn btn-ghost btn-sm btn-full" onClick={logout}>Sign Out</button>
      </div>
    </aside>
  );
}

// ── Order Queue ───────────────────────────────────────────
function OrderQueuePage({ orders, setOrders }) {
  const [updating, setUpdating] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    apiFetch(`/api/v1/orders/restaurant/${RESTAURANT_ID}`).then(setOrders).catch(() => {});
    const ws = new WebSocket(`ws://localhost:8000/api/v1/orders/ws/restaurant/${RESTAURANT_ID}`);
    ws.onmessage = (e) => { const d = JSON.parse(e.data); if (d.type === 'NEW_ORDER') { setOrders(p => [d.order, ...p]); toast.success('🍽️ New order received!'); }};
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const advance = async (order) => {
    const next = NEXT_STATUS[order.status]; if (!next) return;
    setUpdating(order.id);
    try {
      await apiFetch(`/api/v1/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setOrders(p => p.map(o => o.id === order.id ? { ...o, status: next } : o));
      toast.success(`Order ${order.id} → ${next.replace(/_/g,' ')}`);
    } catch (e) { toast.error(e.message); } finally { setUpdating(null); }
  };

  const flag = (order) => toast('🚩 Issue flagged to manager', { icon: '⚠️' });

  const active = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const done = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Order Queue</h1>
          <p className="page-subtitle"><span className="live-dot"/>Live — {active.length} active orders</p>
        </div>
      </div>

      {active.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>All caught up!</div>
          <div className="text-muted text-sm">No active orders at the moment</div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {active.map(order => (
          <div key={order.id} className={`card ${order.status === 'placed' ? 'card-urgent' : ''}`}>
            <div className="flex justify-between items-center mb-3">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{order.id}</span>
                <span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status.replace(/_/g,' ')}</span>
                {order.type === 'room_service' && <span className="badge" style={{ background:'rgba(168,85,247,0.15)', color:'#a855f7' }}>🛎️ Room {order.room_number}</span>}
              </div>
              <span className="text-sm text-muted">{new Date(order.created_at).toLocaleTimeString()}</span>
            </div>
            <div style={{ marginBottom: 14 }}>
              {order.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14 }}>
                  <span>{item.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>×{item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {NEXT_STATUS[order.status] && (
                <button id={`advance-${order.id}`} className="btn btn-primary btn-sm" onClick={() => advance(order)} disabled={updating === order.id}>
                  {updating === order.id ? '...' : `✓ Mark ${NEXT_STATUS[order.status]?.replace(/_/g,' ')}`}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => flag(order)}>🚩 Flag Issue</button>
              <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 15 }}>₹{order.total_amount}</div>
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {done.slice(0, 5).map(order => (
              <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, opacity: 0.7 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{order.id}</span>
                <span className={`badge ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 600 }}>₹{order.total_amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inventory ─────────────────────────────────────────────
function InventoryPage() {
  const [items, setItems] = useState(MOCK_ITEMS);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', category: '', description: '' });

  useEffect(() => {
    apiFetch(`/api/v1/inventory/${RESTAURANT_ID}`).then(d => { if (d.length) setItems(d); }).catch(() => {});
  }, []);

  const toggleAvail = async (item) => {
    const newAvail = !item.is_available;
    try {
      await apiFetch(`/api/v1/inventory/items/${item.id}?restaurant_id=${RESTAURANT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_available: newAvail }),
      });
    } catch (e) { /* fallback: update locally */ }
    setItems(p => p.map(i => i.id === item.id ? { ...i, is_available: newAvail } : i));
    // Write localStorage signal for User App and Admin Dashboard to read
    if (!newAvail) {
      localStorage.setItem(`zf_stock_${item.id}`, 'out');
    } else {
      localStorage.removeItem(`zf_stock_${item.id}`);
    }
    // Dispatch storage event for same-tab listeners (window.dispatchEvent)
    window.dispatchEvent(new StorageEvent('storage', {
      key: `zf_stock_${item.id}`,
      newValue: newAvail ? null : 'out',
      storageArea: localStorage,
    }));
    toast.success(`${item.name} → ${newAvail ? 'Available' : 'Out of Stock'}`);
  };

  const updateStock = async (item, qty) => {
    try {
      await apiFetch(`/api/v1/inventory/items/${item.id}/stock?restaurant_id=${RESTAURANT_ID}&quantity=${qty}`, { method: 'PATCH', body: '{}' });
      setItems(p => p.map(i => i.id === item.id ? { ...i, stock: qty } : i));
      toast.success('Stock updated');
    } catch(e) { toast.error(e.message); }
  };

  const submitItem = async (e) => {
    e.preventDefault();
    try {
      const newItem = await apiFetch('/api/v1/inventory/items', { method: 'POST', body: JSON.stringify({ ...form, price: parseFloat(form.price), restaurant_id: RESTAURANT_ID, is_available: false }) });
      setItems(p => [...p, newItem]);
      setShowAdd(false);
      toast.success('Item submitted for owner approval');
    } catch(e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Manage item availability and stock</p>
        </div>
        <button id="add-item-btn" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Item</button>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div className="text-sm text-muted">{item.category} · ₹{item.price}</div>
            </div>
            {/* Stock editor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="text-sm text-muted">Stock:</span>
              <input id={`stock-${item.id}`} type="number" min="0"
                style={{ width: 60, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center' }}
                value={item.stock ?? 0}
                onChange={e => setItems(p => p.map(i => i.id === item.id ? { ...i, stock: parseInt(e.target.value)||0 } : i))}
                onBlur={e => updateStock(item, parseInt(e.target.value)||0)}
              />
            </div>
            {/* Availability toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{
                width: 40, height: 22, borderRadius: 11,
                background: item.is_available ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: '0.3s', cursor: 'pointer'
              }} onClick={() => toggleAvail(item)}>
                <div style={{
                  position: 'absolute', width: 16, height: 16, borderRadius: '50%', background: 'white',
                  top: 3, left: item.is_available ? 21 : 3, transition: '0.3s'
                }}/>
              </div>
              <span className={`text-sm ${item.is_available ? 'text-success' : 'text-danger'}`}>
                {item.is_available ? 'Available' : 'Out of Stock'}
              </span>
            </label>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAdd(false)}>
          <div style={{ width: 420, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 28 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add New Item</h2>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--warning)' }}>
              ⚠️ New items require owner approval before becoming visible.
            </div>
            <form onSubmit={submitItem}>
              {['name', 'price', 'category'].map(field => (
                <div key={field} style={{ marginBottom: 12 }}>
                  <label className="form-label">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input id={`item-${field}`} className="form-input" value={form[field]} onChange={e => setForm(f=>({...f,[field]:e.target.value}))} required type={field==='price'?'number':'text'}/>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button id="submit-item-btn" type="submit" className="btn btn-primary" style={{ flex: 1 }}>Submit for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Alerts ────────────────────────────────────────────────
function AlertsPage() {
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const markRead = (id) => setAlerts(p => p.map(a => a.id === id ? { ...a, read: true } : a));

  return (
    <div>
      <h1 className="page-title">Alerts</h1>
      <p className="page-subtitle">AI-generated demand spikes and operational alerts</p>
      {alerts.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>No alerts</div>}
      {alerts.map(alert => (
        <div key={alert.id} className="alert-card" style={{ opacity: alert.read ? 0.5 : 1, marginBottom: 10 }}>
          <span className="alert-icon">{alert.type === 'demand_spike' ? '⚡' : '📦'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{alert.message}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(alert.created_at).toLocaleString()}</div>
          </div>
          {!alert.read && (
            <button className="btn btn-ghost btn-sm" onClick={() => markRead(alert.id)}>Mark read</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  const { theme, toggle: toggleTheme } = useStaffTheme();
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('zefood_staff_user')); } catch { return null; }});
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const alertCount = MOCK_ALERTS.filter(a => !a.read).length;
  const activeOrders = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length;

  const handleLogin = async (email, password) => {
    const mockUser = { uid: 'staff-1', email, name: 'Kitchen Staff', role: 'kitchen', restaurant_id: RESTAURANT_ID };
    localStorage.setItem('zefood_staff_token', 'demo-staff-token');
    localStorage.setItem('zefood_staff_user', JSON.stringify(mockUser));
    setUser(mockUser);
  };

  const toasterStyle = theme === 'dark'
    ? { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
    : { background: '#ffffff', color: '#111118', border: '1px solid rgba(0,0,0,0.08)' };

  if (!user) return (
    <BrowserRouter>
      <LoginPage onLogin={handleLogin}/>
      <Toaster position="top-right" toastOptions={{ style: toasterStyle }}/>
    </BrowserRouter>
  );

  return (
    <BrowserRouter>
      <div className="staff-layout">
        <StaffSidebar alertCount={alertCount} orderCount={activeOrders} theme={theme} toggleTheme={toggleTheme}/>
        <main className="staff-main">
          <Routes>
            <Route path="/" element={<OrderQueuePage orders={orders} setOrders={setOrders}/>}/>
            <Route path="/inventory" element={<InventoryPage/>}/>
            <Route path="/alerts" element={<AlertsPage/>}/>
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ style: toasterStyle }}/>
    </BrowserRouter>
  );
}
