import React, { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api';

const RESTAURANT_ID = 'demo-restaurant-1';

const STATUS_BADGE = {
  placed: 'badge-info', accepted: 'badge-info', preparing: 'badge-warning',
  ready: 'badge-warning', out_for_delivery: 'badge-primary', delivered: 'badge-success',
  cancelled: 'badge-danger',
};

const STATUS_FLOW = ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

const MOCK_ORDERS = [
  { id: 'ORD-001', user_id: 'user1', restaurant_id: RESTAURANT_ID, type: 'delivery',
    items: [{ name: 'Butter Chicken', quantity: 2, price: 280 }, { name: 'Naan', quantity: 4, price: 40 }],
    status: 'preparing', total_amount: 720, created_at: new Date(Date.now() - 5*60000).toISOString() },
  { id: 'ORD-002', user_id: 'user2', restaurant_id: RESTAURANT_ID, type: 'room_service',
    items: [{ name: 'Club Sandwich', quantity: 1, price: 320 }],
    status: 'placed', total_amount: 320, created_at: new Date(Date.now() - 60000).toISOString() },
  { id: 'ORD-003', user_id: 'user3', restaurant_id: RESTAURANT_ID, type: 'delivery',
    items: [{ name: 'Paneer Tikka', quantity: 1, price: 350 }],
    status: 'delivered', total_amount: 350, created_at: new Date(Date.now() - 30*60000).toISOString() },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [statusFilter, setStatusFilter] = useState('');
  const [updating, setUpdating] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    api.getAllOrders(RESTAURANT_ID, statusFilter || null).then(setOrders).catch(() => {});

    // WebSocket for live order updates
    const ws = new WebSocket(`ws://localhost:8000/api/v1/orders/ws/restaurant/${RESTAURANT_ID}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'NEW_ORDER') {
        setOrders(prev => [data.order, ...prev]);
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [statusFilter]);

  const handleAdvanceStatus = async (order) => {
    const currentIdx = STATUS_FLOW.indexOf(order.status);
    if (currentIdx === -1 || currentIdx >= STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[currentIdx + 1];
    setUpdating(order.id);
    try {
      await api.updateOrderStatus(order.id, nextStatus, null);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o));
    } catch (_) {}
    setUpdating(null);
  };

  const filtered = statusFilter ? orders.filter(o => o.status === statusFilter) : orders;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Orders</h1>
          <p className="text-muted text-sm">Manage all incoming orders in real-time</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="status-dot"/>
          <span className="text-sm text-muted">Live WebSocket</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['', 'placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map(s => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setStatusFilter(s)}
          >
            {s ? s.replace(/_/g, ' ') : 'All Orders'}
            {!s && <span style={{ marginLeft: 4, opacity: 0.6 }}>({orders.length})</span>}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Type</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const currentIdx = STATUS_FLOW.indexOf(order.status);
              const canAdvance = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
                && order.status !== 'cancelled';
              const nextStatus = canAdvance ? STATUS_FLOW[currentIdx + 1] : null;

              return (
                <tr key={order.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                    {order.id}
                  </td>
                  <td>
                    <span className={`badge ${order.type === 'room_service' ? 'badge-primary' : 'badge-muted'}`}>
                      {order.type === 'room_service' ? '🛎️ Room' : '🚴 Delivery'}
                    </span>
                  </td>
                  <td className="text-sm">
                    {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                  </td>
                  <td style={{ fontWeight: 700 }}>₹{order.total_amount}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[order.status] || 'badge-muted'}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="text-muted text-sm">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </td>
                  <td>
                    {canAdvance && (
                      <button
                        id={`advance-${order.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleAdvanceStatus(order)}
                        disabled={updating === order.id}
                        style={{ fontSize: 12 }}
                      >
                        {updating === order.id ? '...' : `→ ${nextStatus?.replace(/_/g,' ')}`}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
