const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const getToken = () => localStorage.getItem('zefood_token');

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error');
  }
  return res.json();
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),

  // Analytics
  getDemand: (restaurantId, hours = 24) =>
    apiFetch(`/api/v1/analytics/demand/${restaurantId}?horizon_hours=${hours}`),
  getSentimentTrends: (restaurantId) =>
    apiFetch(`/api/v1/analytics/sentiment-trends/${restaurantId}`),
  getOrderStats: (restaurantId) =>
    apiFetch(`/api/v1/analytics/orders?restaurant_id=${restaurantId}`),

  // Orders
  getAllOrders: (restaurantId, status) =>
    apiFetch(`/api/v1/orders/restaurant/${restaurantId}${status ? `?status_filter=${status}` : ''}`),
  updateOrderStatus: (orderId, status, note) =>
    apiFetch(`/api/v1/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),

  // Staff
  listStaff: (restaurantId) =>
    apiFetch(`/api/v1/staff/${restaurantId ? `?restaurant_id=${restaurantId}` : ''}`),
  createStaff: (data) => apiFetch('/api/v1/staff/', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id, data) => apiFetch(`/api/v1/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStaff: (id) => apiFetch(`/api/v1/staff/${id}`, { method: 'DELETE' }),

  // Inventory
  listItems: (restaurantId) => apiFetch(`/api/v1/inventory/${restaurantId}`),
  updateItem: (id, restaurantId, data) =>
    apiFetch(`/api/v1/inventory/items/${id}?restaurant_id=${restaurantId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  approveItem: (id, restaurantId) =>
    apiFetch(`/api/v1/inventory/items/${id}/approve?restaurant_id=${restaurantId}`, { method: 'PATCH', body: '{}' }),
  deleteItem: (id, restaurantId) =>
    apiFetch(`/api/v1/inventory/items/${id}?restaurant_id=${restaurantId}`, { method: 'DELETE' }),

  // Reviews
  getReviews: (restaurantId) => apiFetch(`/api/v1/reviews/${restaurantId}`),
};

export default api;
