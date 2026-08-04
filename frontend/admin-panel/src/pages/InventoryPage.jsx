import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

const RESTAURANT_ID = 'demo-restaurant-1';

const MOCK_ITEMS = [
  { id: 'item1', name: 'Butter Chicken', price: 280, category: 'Main Course', is_available: true, stock: 20, is_vegetarian: false, pending_approval: false },
  { id: 'item2', name: 'Paneer Tikka', price: 350, category: 'Starters', is_available: true, stock: 15, is_vegetarian: true, pending_approval: false },
  { id: 'item3', name: 'Dal Makhani', price: 180, category: 'Main Course', is_available: false, stock: 0, is_vegetarian: true, pending_approval: false },
  { id: 'item4', name: 'New Special Biryani', price: 420, category: 'Main Course', is_available: false, stock: 0, is_vegetarian: false, pending_approval: true },
];

export default function InventoryPage() {
  const [items, setItems] = useState(MOCK_ITEMS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listItems(RESTAURANT_ID).then(data => { if (data.length) setItems(data); }).catch(() => {});
  }, []);

  const toggleAvailability = async (item) => {
    try {
      await api.updateItem(item.id, RESTAURANT_ID, { is_available: !item.is_available });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i));
    } catch (_) {}
  };

  const approveItem = async (item) => {
    try {
      await api.approveItem(item.id, RESTAURANT_ID);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, pending_approval: false, is_available: true } : i));
    } catch (_) {}
  };

  const deleteItem = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.deleteItem(item.id, RESTAURANT_ID);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (_) {}
  };

  const pending = items.filter(i => i.pending_approval);
  const active = items.filter(i => !i.pending_approval);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Inventory</h1>
          <p className="text-muted text-sm">Manage menu items and stock</p>
        </div>
      </div>

      {/* Pending Approval */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-center gap-2 mb-3">
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Pending Approval</h2>
            <span className="badge badge-warning">{pending.length}</span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {pending.map(item => (
              <div key={item.id} className="card" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                background: 'rgba(245, 158, 11, 0.05)'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="text-muted text-sm">₹{item.price} · {item.category}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button id={`approve-${item.id}`} className="btn btn-primary btn-sm"
                    onClick={() => approveItem(item)}>✓ Approve</button>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => deleteItem(item)}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Items */}
      <div className="table-container">
        <div className="table-header">
          <div className="card-title">Menu Items</div>
          <div className="text-muted text-sm">{active.length} items</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {active.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td className="text-muted text-sm">{item.category}</td>
                <td style={{ fontWeight: 700 }}>₹{item.price}</td>
                <td>{item.stock ?? '—'}</td>
                <td>
                  <span className={`badge ${item.is_vegetarian ? 'badge-success' : 'badge-danger'}`}>
                    {item.is_vegetarian ? '🌱 Veg' : '🍖 Non-veg'}
                  </span>
                </td>
                <td>
                  <button
                    id={`toggle-${item.id}`}
                    className={`badge ${item.is_available ? 'badge-success' : 'badge-danger'}`}
                    style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                    onClick={() => toggleAvailability(item)}
                  >
                    {item.is_available ? '✓ Available' : '✗ Out of Stock'}
                  </button>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => deleteItem(item)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
