import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// Reads Staff Panel inventory signals from localStorage
function getInventoryAlerts() {
  const alerts = [];
  const itemNames = { i1: 'Butter Chicken', i2: 'Paneer Tikka', i3: 'Dal Makhani', i4: 'Garlic Naan', i5: 'Biryani' };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('zf_stock_') && localStorage.getItem(key) === 'out') {
      const itemId = key.replace('zf_stock_', '');
      alerts.push({ itemId, name: itemNames[itemId] || itemId });
    }
  }
  return alerts;
}

const RESTAURANT_ID = 'demo-restaurant-1'; // TODO: from user profile

const mockStats = {
  total_orders: 1284,
  delivered: 1197,
  cancelled: 87,
  revenue: 284650.50,
};

const mockDemand = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  expected_orders: Math.max(2, Math.round(15 * Math.sin((i - 6) * Math.PI / 12) + 12 + Math.random() * 4)),
  is_peak: i >= 12 && i <= 14 || i >= 19 && i <= 21,
}));

const mockActivity = [
  { day: 'Mon', orders: 134 }, { day: 'Tue', orders: 178 },
  { day: 'Wed', orders: 156 }, { day: 'Thu', orders: 201 },
  { day: 'Fri', orders: 245 }, { day: 'Sat', orders: 312 }, { day: 'Sun', orders: 289 },
];

const recentOrders = [
  { id: 'ORD-001', customer: 'Arjun Sharma', items: 3, total: 650, status: 'preparing', time: '2 min ago' },
  { id: 'ORD-002', customer: 'Priya Nair', items: 1, total: 180, status: 'out_for_delivery', time: '8 min ago' },
  { id: 'ORD-003', customer: 'Ravi Kumar', items: 5, total: 1250, status: 'delivered', time: '15 min ago' },
  { id: 'ORD-004', customer: 'Sneha Patel', items: 2, total: 420, status: 'placed', time: '1 min ago' },
];

const STATUS_BADGE = {
  placed: 'badge-info', accepted: 'badge-info', preparing: 'badge-warning',
  ready: 'badge-warning', out_for_delivery: 'badge-primary', delivered: 'badge-success',
  cancelled: 'badge-danger',
};

function StatCard({ icon, label, value, change, color, emoji }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color }}>
      <div className="stat-icon" style={{ background: `${color}20` }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change ${change > 0 ? 'up' : 'down'}`}>
        {change > 0 ? '↑' : '↓'} {Math.abs(change)}% vs last week
      </div>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(mockStats);
  const [demandData, setDemandData] = useState(mockDemand);
  const [inventoryAlerts, setInventoryAlerts] = useState(() => getInventoryAlerts());

  useEffect(() => {
    api.getOrderStats(RESTAURANT_ID).then(setStats).catch(() => {});
    api.getDemand(RESTAURANT_ID, 24).then(d => {
      if (d.hourly) setDemandData(d.hourly.map(h => ({
        hour: `${h.hour}:00`, expected_orders: h.expected_orders, is_peak: h.is_peak
      })));
    }).catch(() => {});

    // Listen for staff inventory signal changes
    const handler = (e) => {
      if (e.key && e.key.startsWith('zf_stock_')) setInventoryAlerts(getInventoryAlerts());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-muted text-sm mt-2">Real-time overview of your restaurant</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="ws-live-indicator">
            <span className="status-dot" />
            Live
          </span>
        </div>
      </div>

      {/* Inventory Alerts from Staff Panel */}
      {inventoryAlerts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            📦 Inventory Alerts
            <span className="badge badge-warning">{inventoryAlerts.length} out of stock</span>
          </div>
          {inventoryAlerts.map(alert => (
            <div key={alert.itemId} className="inventory-alert-card">
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{alert.name}</div>
                <div style={{ fontSize: 12, color: 'var(--warning)' }}>Marked out of stock by staff</div>
              </div>
              <a href="/inventory" className="btn btn-ghost btn-sm">Review →</a>
            </div>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="stat-grid">
        <StatCard emoji="📦" label="Total Orders" value={stats.total_orders?.toLocaleString()}
          change={12} color="var(--primary)" />
        <StatCard emoji="✅" label="Delivered" value={stats.delivered?.toLocaleString()}
          change={8} color="var(--success)" />
        <StatCard emoji="💰" label="Revenue (₹)" value={`₹${(stats.revenue / 1000).toFixed(1)}K`}
          change={15} color="var(--accent)" />
        <StatCard emoji="❌" label="Cancelled" value={stats.cancelled}
          change={-3} color="var(--danger)" />
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-6">
        {/* Weekly Order Volume */}
        <div className="chart-container">
          <div className="card-title mb-4" style={{ fontFamily: 'var(--font-heading)' }}>Weekly Order Volume</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mockActivity} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--primary)' }}/>
              <Bar dataKey="orders" fill="url(#barGradient)" radius={[4,4,0,0]}/>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff7832"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Demand Forecast */}
        <div className="chart-container">
          <div className="flex justify-between items-center mb-4">
            <div className="card-title" style={{ fontFamily: 'var(--font-heading)' }}>Hourly Demand Forecast</div>
            <span className="badge badge-primary">AI Predicted</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={demandData.filter((_, i) => i % 2 === 0)}>
              <defs>
                <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff7832" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff7832" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}/>
              <Area type="monotone" dataKey="expected_orders" stroke="#ff7832" strokeWidth={2}
                fill="url(#demandGradient)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="table-container">
        <div className="table-header">
          <div className="card-title" style={{ fontFamily: 'var(--font-heading)' }}>Recent Orders</div>
          <a href="/orders" className="btn btn-ghost btn-sm">View All →</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map(order => (
              <tr key={order.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--primary)' }}>{order.id}</td>
                <td style={{ fontWeight: 500 }}>{order.customer}</td>
                <td className="text-muted">{order.items} items</td>
                <td style={{ fontWeight: 600 }}>₹{order.total}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[order.status] || 'badge-muted'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="text-muted text-sm">{order.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
