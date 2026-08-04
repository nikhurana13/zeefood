import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const getToken = () => localStorage.getItem('zf_token');
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts, headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Error'); }
  return res.json();
}

// ── Theme Hook ─────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('zf_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zf_theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

// ── Inventory Signal Hook ──────────────────────
// Reads zf_stock_{itemId} from localStorage to check if staff marked item out-of-stock
function useStockSignals() {
  const [outOfStock, setOutOfStock] = useState(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zf_stock_') && localStorage.getItem(key) === 'out') {
        result[key.replace('zf_stock_', '')] = true;
      }
    }
    return result;
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key && e.key.startsWith('zf_stock_')) {
        const itemId = e.key.replace('zf_stock_', '');
        setOutOfStock(prev => {
          if (e.newValue === 'out') return { ...prev, [itemId]: true };
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return outOfStock;
}

// ── Recommendations Hook ───────────────────────
// Reads zf_reviewed_{restaurantId} keys to compute "Because you enjoyed…" recs
function usePersonalizedRecs() {
  const [recs, setRecs] = useState(() => {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zf_reviewed_')) {
        const id = key.replace('zf_reviewed_', '');
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        result.push({ restaurantId: id, ...data });
      }
    }
    return result;
  });
  const refresh = useCallback(() => {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zf_reviewed_')) {
        const id = key.replace('zf_reviewed_', '');
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        result.push({ restaurantId: id, ...data });
      }
    }
    setRecs(result);
  }, []);
  return { recs, refresh };
}

// ══════════════════════════════════════════════
// Mock Data
// ══════════════════════════════════════════════
const RESTAURANTS = [
  { id: 'r1', name: 'Spice Garden', type: 'restaurant', cuisine: ['Indian', 'Mughlai'], rating: 4.5, emoji: '🍛', time: '30–40 min', category: 'restaurant', priceFor2: 600 },
  { id: 'r2', name: 'Pizza Palace', type: 'restaurant', cuisine: ['Italian', 'Fast Food'], rating: 4.2, emoji: '🍕', time: '25–35 min', category: 'restaurant', priceFor2: 450 },
  { id: 'r3', name: 'Sushi World', type: 'restaurant', cuisine: ['Japanese'], rating: 4.7, emoji: '🍱', time: '40–50 min', category: 'restaurant', priceFor2: 900 },
  { id: 'r4', name: 'Hotel Royal — Pantry', type: 'hotel', cuisine: ['Multi-cuisine'], rating: 4.6, emoji: '🏨', time: '15–20 min', category: 'hotel', priceFor2: 0, isRoomService: true },
  { id: 'r5', name: 'FreshMart', type: 'mart', cuisine: ['Groceries', 'Fresh'], rating: 4.3, emoji: '🛒', time: '45–60 min', category: 'mart', priceFor2: 0 },
];

const MENUS = {
  r1: [
    { id: 'i1', name: 'Butter Chicken', desc: 'Tender chicken in rich tomato-cream sauce', price: 280, emoji: '🍗', category: 'Main Course', veg: false },
    { id: 'i2', name: 'Paneer Tikka', desc: 'Marinated paneer grilled in tandoor', price: 350, emoji: '🧆', category: 'Starters', veg: true },
    { id: 'i3', name: 'Dal Makhani', desc: 'Slow-cooked black lentils in cream', price: 180, emoji: '🫕', category: 'Main Course', veg: true },
    { id: 'i4', name: 'Garlic Naan', desc: 'Soft bread with garlic butter', price: 45, emoji: '🫓', category: 'Bread', veg: true },
    { id: 'i5', name: 'Biryani', desc: 'Fragrant basmati rice with spices', price: 320, emoji: '🍚', category: 'Rice', veg: false },
  ],
  r2: [
    { id: 'p1', name: 'Margherita Pizza', desc: 'Classic tomato, mozzarella, basil', price: 299, emoji: '🍕', category: 'Pizza', veg: true },
    { id: 'p2', name: 'BBQ Chicken Pizza', desc: 'BBQ sauce, grilled chicken, onions', price: 399, emoji: '🍕', category: 'Pizza', veg: false },
    { id: 'p3', name: 'Pasta Arrabbiata', desc: 'Penne in spicy tomato sauce', price: 249, emoji: '🍝', category: 'Pasta', veg: true },
  ],
  r3: [
    { id: 's1', name: 'Salmon Nigiri', desc: 'Fresh salmon on seasoned rice', price: 420, emoji: '🐟', category: 'Sushi', veg: false },
    { id: 's2', name: 'Veggie Roll', desc: 'Cucumber, avocado, pickled radish', price: 280, emoji: '🌀', category: 'Rolls', veg: true },
  ],
  r4: [
    { id: 'h1', name: 'Club Sandwich', desc: 'Triple-layered with chicken and veggies', price: 320, emoji: '🥪', category: 'Snacks', veg: false },
    { id: 'h2', name: 'Continental Breakfast', desc: 'Eggs, toast, sausage, OJ', price: 450, emoji: '🍳', category: 'Breakfast', veg: false },
    { id: 'h3', name: 'Fresh Juice', desc: 'Orange / Watermelon / Mixed', price: 120, emoji: '🥤', category: 'Drinks', veg: true },
  ],
  r5: [
    { id: 'g1', name: 'Organic Milk 1L', desc: 'Farm fresh full-cream milk', price: 68, emoji: '🥛', category: 'Dairy', veg: true },
    { id: 'g2', name: 'Whole Wheat Bread', desc: '400g loaf, no preservatives', price: 42, emoji: '🍞', category: 'Bakery', veg: true },
    { id: 'g3', name: 'Amul Butter 500g', desc: 'Pasteurised table butter', price: 230, emoji: '🧈', category: 'Dairy', veg: true },
  ],
};

const CATEGORIES = [
  { id: 'all', emoji: '🏠', label: 'All' },
  { id: 'restaurant', emoji: '🍽️', label: 'Restaurants' },
  { id: 'hotel', emoji: '🏨', label: 'Hotel' },
  { id: 'mart', emoji: '🛒', label: 'Mart' },
];

const ORDER_STEPS = [
  { key: 'placed', label: 'Order Placed', emoji: '📋', desc: 'Restaurant received your order' },
  { key: 'accepted', label: 'Accepted', emoji: '✅', desc: 'Restaurant accepted your order' },
  { key: 'preparing', label: 'Preparing', emoji: '👨‍🍳', desc: 'Kitchen is preparing your food' },
  { key: 'ready', label: 'Ready', emoji: '📦', desc: 'Order is packed and ready' },
  { key: 'out_for_delivery', label: 'On the Way', emoji: '🛵', desc: 'Delivery partner is on the way' },
  { key: 'delivered', label: 'Delivered', emoji: '🎉', desc: 'Enjoy your meal!' },
];

const EMOTION_ICONS = { joy: '😊', anger: '😠', sadness: '😢', neutral: '😐', surprise: '😲', fear: '😨', disgust: '🤢' };

// ══════════════════════════════════════════════
// Login Screen
// ══════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await onLogin(form.email, form.password, form.name, mode); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-screen">
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🍽️</div>
        <div className="login-logo">ZEfood</div>
        <div style={{ color: 'var(--text2)', fontSize: 14, marginTop: 6, fontFamily: 'var(--font-body)' }}>
          Discover. Order. Enjoy.
        </div>
      </div>

      <div style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}>
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', background: 'var(--card)', marginBottom: 20 }}>
          {['login', 'register'].map(m => (
            <button key={m} style={{
              flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
              background: mode === m ? 'var(--primary)' : 'transparent',
              color: mode === m ? 'white' : 'var(--text2)',
              fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-body)', transition: 'all 0.2s',
            }} onClick={() => setMode(m)}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <input id="user-name" className="form-input"
                placeholder="Full name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
          )}
          <div className="form-group">
            <input id="user-email" className="form-input" type="email"
              placeholder="Email address" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <input id="user-password" className="form-input" type="password"
              placeholder="Password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <button id="user-auth-btn" className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Home Screen — with Recommendations
// ══════════════════════════════════════════════
function HomeScreen({ cart, setCart, onSelectRestaurant }) {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { recs } = usePersonalizedRecs();

  const filtered = RESTAURANTS.filter(r =>
    (category === 'all' || r.category === category) &&
    (r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.some(c => c.toLowerCase().includes(search.toLowerCase())))
  );

  // Build recommendation map: restaurantId -> rec data
  const recMap = {};
  recs.forEach(rec => { recMap[rec.restaurantId] = rec; });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero">
        <div className="hero-greeting">Good {greeting} 👋</div>
        <h1 className="hero-title">What are you<br />craving today?</h1>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input id="search-input" placeholder="Search restaurants, dishes..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Categories */}
      <div className="category-row">
        {CATEGORIES.map(cat => (
          <button key={cat.id} id={`cat-${cat.id}`}
            className={`category-pill ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Personalized Recommendations */}
      {recs.length > 0 && (
        <>
          <div className="section-header">
            <div className="section-title">✨ Recommended for You</div>
          </div>
          {recs.map(rec => {
            const restaurant = RESTAURANTS.find(r => r.id === rec.restaurantId);
            if (!restaurant) return null;
            return (
              <div key={rec.restaurantId} className="restaurant-card" id={`rec-${rec.restaurantId}`}
                onClick={() => onSelectRestaurant(restaurant)}>
                <div className="restaurant-img"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(249,115,22,0.08))' }}>
                  {restaurant.emoji}
                </div>
                <div className="restaurant-info">
                  <div className="restaurant-name">{restaurant.name}</div>
                  <div className="recommendation-tag">
                    ✨ Because you rated this {rec.rating ? `${rec.rating}★` : 'highly'}
                  </div>
                  <div className="restaurant-meta">
                    <span className="restaurant-rating">⭐ {restaurant.rating}</span>
                    <span className="restaurant-tag">⏱ {restaurant.time}</span>
                    <span className="restaurant-tag">{restaurant.cuisine.join(', ')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Restaurant List */}
      <div className="section-header">
        <div className="section-title">🔥 Popular Near You</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{filtered.length} places</div>
      </div>

      {filtered.map(r => (
        <div key={r.id} className="restaurant-card" id={`restaurant-${r.id}`}
          onClick={() => onSelectRestaurant(r)}>
          <div className="restaurant-img"
            style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(139,92,246,0.07))' }}>
            {r.emoji}
          </div>
          <div className="restaurant-info">
            <div className="restaurant-name">{r.name}</div>
            <div className="restaurant-meta">
              <span className="restaurant-rating">⭐ {r.rating}</span>
              <span className="restaurant-tag">⏱ {r.time}</span>
              <span className="restaurant-tag">{r.cuisine.join(', ')}</span>
              {r.isRoomService && (
                <span style={{ fontSize: 11, color: '#a855f7', background: 'rgba(168,85,247,0.1)', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>
                  🛎️ Room Service
                </span>
              )}
              {recMap[r.id] && (
                <span className="recommendation-tag" style={{ margin: 0 }}>✨ Recommended</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text2)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          No restaurants match your search
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// Restaurant Detail — with Sold-Out Overlay
// ══════════════════════════════════════════════
function RestaurantScreen({ restaurant, cart, setCart, onBack }) {
  const menu = MENUS[restaurant.id] || [];
  const categories = [...new Set(menu.map(i => i.category))];
  const [activeCategory, setActiveCategory] = useState(categories[0] || '');
  const outOfStock = useStockSignals();

  const cartQty = (itemId) => (cart.find(c => c.id === itemId)?.quantity || 0);

  const addToCart = (item) => {
    if (outOfStock[item.id]) return;
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1, restaurant_id: restaurant.id, restaurant_name: restaurant.name }];
    });
    toast.success(`${item.name} added to cart`, { duration: 1500 });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.id !== itemId);
      return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const filtered = activeCategory ? menu.filter(i => i.category === activeCategory) : menu;

  return (
    <div className="page">
      {/* Sub-header */}
      <div style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)', background: 'var(--bg)',
        backdropFilter: 'blur(20px)', position: 'sticky', top: 60, zIndex: 40,
      }}>
        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text)' }}>{restaurant.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>⭐ {restaurant.rating} · {restaurant.time}</div>
        </div>
      </div>

      {/* Hero Banner */}
      <div style={{
        height: 140,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(139,92,246,0.08))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 72, borderBottom: '1px solid var(--border)',
      }}>
        {restaurant.emoji}
      </div>

      {/* Category filter */}
      <div className="category-row" style={{ padding: '12px 16px 0' }}>
        {categories.map(cat => (
          <button key={cat} className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div style={{ marginTop: 12 }}>
        {filtered.map(item => {
          const isSoldOut = !!outOfStock[item.id];
          const qty = cartQty(item.id);
          return (
            <div key={item.id} className={`menu-item ${isSoldOut ? 'sold-out' : ''}`} id={`menu-${item.id}`}>
              <div className="menu-item-img">{item.emoji}</div>
              <div className="menu-item-info">
                <div style={{ display: 'flex', gap: 6, marginBottom: 2, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: item.veg ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {item.veg ? '🌱' : '🍖'}
                  </span>
                  {isSoldOut && <span className="sold-out-badge">Sold Out</span>}
                </div>
                <div className="menu-item-name">{item.name}</div>
                <div className="menu-item-desc">{item.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="menu-item-price">₹{item.price}</div>
                  {!isSoldOut && (qty === 0 ? (
                    <button id={`add-${item.id}`} className="add-btn" onClick={() => addToCart(item)}>+ Add</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="qty-btn" onClick={() => removeFromCart(item.id)}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center', color: 'var(--text)' }}>{qty}</span>
                      <button className="qty-btn" style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: 'white' }}
                        onClick={() => addToCart(item)}>+</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Cart & Checkout
// ══════════════════════════════════════════════
function CartScreen({ cart, setCart, onOrderPlaced }) {
  const [address, setAddress] = useState('123 MG Road, Bengaluru');
  const [roomNumber, setRoomNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const restaurantId = cart[0]?.restaurant_id || 'r1';
  const isRoomService = RESTAURANTS.find(r => r.id === restaurantId)?.isRoomService;

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const orderData = {
        restaurant_id: restaurantId,
        type: isRoomService ? 'room_service' : 'delivery',
        items: cart.map(i => ({ item_id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        delivery_address: isRoomService ? null : { label: 'Home', line1: address, city: 'Bengaluru', pincode: '560001' },
        room_number: isRoomService ? roomNumber : null,
        payment_method: 'razorpay',
      };
      let orderId;
      try {
        const res = await apiFetch('/api/v1/orders/', { method: 'POST', body: JSON.stringify(orderData) });
        orderId = res.id;
      } catch {
        orderId = `ORD-${Date.now().toString().slice(-6)}`;
      }
      // Store current order for chatbot context
      localStorage.setItem('zf_current_order', JSON.stringify({ id: orderId, status: 'placed', restaurantId }));
      setCart([]);
      toast.success('Order placed successfully! 🎉');
      onOrderPlaced(orderId);
    } finally { setLoading(false); }
  };

  if (cart.length === 0) return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>Your cart is empty</div>
      <div style={{ color: 'var(--text2)', fontSize: 13 }}>Add items from a restaurant to get started</div>
    </div>
  );

  return (
    <div className="page">
      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>Your Cart</h1>
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>{cart[0]?.restaurant_name}</div>
      </div>

      <div style={{ padding: '16px' }}>
        {cart.map(item => (
          <div key={item.id} className="cart-item">
            <div style={{ fontSize: 28 }}>{item.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{item.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>₹{item.price} each</div>
            </div>
            <div className="cart-qty-ctrl">
              <button className="qty-btn" onClick={() => setCart(p => {
                const e = p.find(c => c.id === item.id);
                if (e.quantity === 1) return p.filter(c => c.id !== item.id);
                return p.map(c => c.id === item.id ? { ...c, quantity: c.quantity - 1 } : c);
              })}>−</button>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{item.quantity}</span>
              <button className="qty-btn" style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: 'white' }}
                onClick={() => setCart(p => p.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c))}>+</button>
            </div>
            <div style={{ minWidth: 56, textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>₹{item.price * item.quantity}</div>
          </div>
        ))}

        <div className="divider" />

        {/* Delivery Details */}
        <div className="form-group">
          <label className="form-label">{isRoomService ? '🛎️ Room Number' : '📍 Delivery Address'}</label>
          <input id={isRoomService ? 'room-number' : 'delivery-address'} className="form-input"
            value={isRoomService ? roomNumber : address}
            onChange={e => isRoomService ? setRoomNumber(e.target.value) : setAddress(e.target.value)}
            placeholder={isRoomService ? 'Enter room number' : 'Enter delivery address'} />
        </div>

        {/* Bill Summary */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Bill Summary</div>
          {cart.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
              <span>{i.name} ×{i.quantity}</span>
              <span>₹{i.price * i.quantity}</span>
            </div>
          ))}
          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
            <span>Delivery Fee</span><span>₹{isRoomService ? 0 : 30}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, marginTop: 8, color: 'var(--text)' }}>
            <span style={{ fontFamily: 'var(--font-heading)' }}>Total</span>
            <span style={{ color: 'var(--primary)' }}>₹{total + (isRoomService ? 0 : 30)}</span>
          </div>
        </div>

        <button id="place-order-btn" className="btn btn-primary btn-full" onClick={placeOrder} disabled={loading}>
          {loading ? <span className="spinner" /> : `💳 Pay ₹${total + (isRoomService ? 0 : 30)} via Razorpay`}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Order Tracking — Real-time Status Timeline
// ══════════════════════════════════════════════
function TrackingScreen({ orderId, onStatusChange }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    // Update chatbot context whenever status changes
    const updateOrderContext = (status) => {
      const existing = JSON.parse(localStorage.getItem('zf_current_order') || '{}');
      localStorage.setItem('zf_current_order', JSON.stringify({ ...existing, id: orderId, status }));
      if (onStatusChange) onStatusChange(status);
    };

    const wsBase = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/api/v1/orders/ws/${orderId}`);
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === 'ORDER_STATUS_UPDATE') {
        const idx = ORDER_STEPS.findIndex(s => s.key === d.status);
        if (idx > -1) { setStepIdx(idx); updateOrderContext(d.status); }
      }
    };
    ws.onclose = () => setConnected(false);
    wsRef.current = ws;

    // Demo progression simulation
    let i = 0;
    const demo = setInterval(() => {
      i++;
      if (i >= ORDER_STEPS.length) { clearInterval(demo); return; }
      setStepIdx(i);
      updateOrderContext(ORDER_STEPS[i].key);
    }, 4000);

    return () => { ws.close(); clearInterval(demo); };
  }, [orderId]);

  if (!orderId) return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, marginTop: 4, marginBottom: 8, color: 'var(--text)' }}>No active order</div>
      <div style={{ color: 'var(--text2)', fontSize: 13 }}>Place an order to track it here</div>
    </div>
  );

  const currentStep = ORDER_STEPS[stepIdx];
  const isDelivered = stepIdx === ORDER_STEPS.length - 1;

  return (
    <div className="page">
      <div style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Tracking Order</h1>
            <div style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: 14, marginTop: 4 }}>{orderId}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: connected ? 'var(--success)' : 'var(--text2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--text2)', animation: connected ? 'pulse 2s infinite' : 'none' }} />
            {connected ? 'Live' : 'Connecting…'}
          </div>
        </div>

        {/* Big Status Hero */}
        <div style={{
          textAlign: 'center', padding: '28px 0 32px',
          background: isDelivered
            ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.04))'
            : 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(139,92,246,0.06))',
          borderRadius: 20, marginBottom: 28,
          border: `1px solid ${isDelivered ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
        }}>
          <div style={{ fontSize: 68, marginBottom: 12, animation: !isDelivered ? 'pulse 2s infinite' : 'none' }}>
            {currentStep?.emoji}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, color: isDelivered ? 'var(--success)' : 'var(--text)' }}>
            {currentStep?.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>{currentStep?.desc}</div>
          {!isDelivered && (
            <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', background: 'var(--card)', padding: '6px 14px', borderRadius: 100, border: '1px solid var(--border)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s infinite' }} />
              Updating in real-time
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="status-track">
          {ORDER_STEPS.map((step, i) => (
            <div key={step.key} className={`track-step ${i < stepIdx ? 'done' : i === stepIdx ? 'current' : ''}`}>
              <div className="track-dot">
                {i < stepIdx ? '✓' : step.emoji}
              </div>
              <div>
                <div className="track-label" style={{
                  color: i === stepIdx ? 'var(--primary)' : i < stepIdx ? 'var(--success)' : 'var(--text3)',
                }}>
                  {step.label}
                </div>
                <div className="track-desc">{step.desc}</div>
                {i === stepIdx && !isDelivered && (
                  <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 3, fontWeight: 600 }}>In progress…</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Review Page — feeds Recommendations
// ══════════════════════════════════════════════
function ReviewScreen({ orderId }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [recording, setRecording] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emotion, setEmotion] = useState(null);
  const [loading, setLoading] = useState(false);
  const { refresh } = usePersonalizedRecs();

  const submitReview = async () => {
    if (!rating || !review.trim()) { toast.error('Please add a rating and write your review'); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/reviews/text', {
        method: 'POST',
        body: JSON.stringify({ restaurant_id: 'r1', text: review, rating }),
      });
      setEmotion(res.combined_emotion || res.sentiment?.label || 'neutral');
    } catch {
      const emotions = ['joy', 'neutral', 'joy', 'surprise'];
      setEmotion(emotions[Math.floor(Math.random() * emotions.length)]);
    }

    // Write recommendation signal to localStorage
    localStorage.setItem('zf_reviewed_r1', JSON.stringify({
      rating,
      restaurantName: 'Spice Garden',
      emotion: emotion || 'joy',
      reviewedAt: new Date().toISOString(),
    }));
    refresh();
    setSubmitted(true);
    toast.success('Review submitted! 🎉');
    setLoading(false);
  };

  const toggleRecording = () => {
    setRecording(r => !r);
    if (!recording) setTimeout(() => { setRecording(false); toast('🎤 Audio review captured!'); }, 3000);
  };

  if (submitted) return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Thank you!</div>
      <div style={{ color: 'var(--text2)', marginBottom: 24, fontSize: 14 }}>Your review has been submitted and will improve your recommendations.</div>
      {emotion && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 24px', width: '100%' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>AI detected your emotion:</div>
          <span className={`emotion-badge emotion-${emotion}`} style={{ fontSize: 14, padding: '6px 16px' }}>
            {EMOTION_ICONS[emotion] || '😊'} {emotion}
          </span>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--accent2)' }}>
            ✨ Recommendations updated based on your review
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="page">
      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>Rate Your Order</h1>
        <div style={{ color: 'var(--text2)', fontSize: 13 }}>Your feedback shapes your recommendations</div>
      </div>

      <div className="review-card">
        {/* Star Rating */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>Overall Rating</div>
          <div className="star-row">
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} onClick={() => setRating(s)} style={{
                color: s <= rating ? '#fbbf24' : 'var(--text3)',
                transition: 'transform 0.15s',
                transform: s <= rating ? 'scale(1.15)' : 'scale(1)',
                cursor: 'pointer',
              }}>★</span>
            ))}
          </div>
        </div>

        {/* Text Review */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Write a Review</div>
          <textarea id="review-text" value={review} onChange={e => setReview(e.target.value)}
            className="form-input" style={{ resize: 'vertical', minHeight: 100 }}
            placeholder="Share your experience with us..." />
        </div>

        {/* Audio Review */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>Or Record an Audio Review</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button id="record-btn" className={`record-btn ${recording ? 'recording' : ''}`} onClick={toggleRecording}>
              {recording ? '⏹' : '🎤'}
            </button>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {recording ? 'Recording… tap to stop' : 'Tap to record (AI emotion analysis)'}
            </div>
          </div>
        </div>

        <button id="submit-review-btn" className="btn btn-primary btn-full" onClick={submitReview} disabled={loading}>
          {loading ? <span className="spinner" /> : '✓ Submit Review'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Profile
// ══════════════════════════════════════════════
function ProfileScreen({ user, onLogout }) {
  const pastOrders = [
    { id: 'ORD-001', restaurant: 'Spice Garden', items: 3, total: 650, status: 'delivered', date: 'Yesterday' },
    { id: 'ORD-002', restaurant: 'Pizza Palace', items: 2, total: 748, status: 'delivered', date: '2 days ago' },
  ];

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || '👤'}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{user?.name || 'Guest User'}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{user?.email}</div>
      </div>

      <div style={{ padding: '16px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, marginBottom: 12, color: 'var(--text)', fontSize: 17 }}>Order History</div>
        {pastOrders.map(o => (
          <div key={o.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--text)' }}>{o.restaurant}</div>
              <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.12)', color: 'var(--success)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{o.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}>
              <span>{o.items} items · {o.date}</span>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>₹{o.total}</span>
            </div>
          </div>
        ))}

        <div className="divider" />
        <button id="user-logout-btn" className="btn btn-ghost btn-full" onClick={onLogout}>Sign Out</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Chat Widget — Order Context Aware
// ══════════════════════════════════════════════
function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I\'m ZEfood\'s AI assistant 🍽️ How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Read current order context
  const currentOrder = (() => {
    try { return JSON.parse(localStorage.getItem('zf_current_order') || '{}'); }
    catch { return {}; }
  })();
  const hasOrderContext = !!(currentOrder.id);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const buildContextualResponse = (userMsg) => {
    const lower = userMsg.toLowerCase();
    if (hasOrderContext && (lower.includes('order') || lower.includes('where') || lower.includes('status') || lower.includes('track'))) {
      const status = currentOrder.status || 'placed';
      const step = ORDER_STEPS.find(s => s.key === status);
      return `Your order **${currentOrder.id}** is currently: **${step?.label || status}** — ${step?.desc || ''}. I'll notify you when the status changes!`;
    }
    if (lower.includes('menu') || lower.includes('food')) return 'Check out our Home tab to browse all restaurants and their menus. You can filter by Restaurant, Hotel or Mart!';
    if (lower.includes('cancel')) return 'Orders can be cancelled within 2 minutes of placing them. For assistance, please contact our support team.';
    if (lower.includes('payment') || lower.includes('pay')) return 'We accept payments via Razorpay — credit/debit cards, UPI, and net banking. All transactions are encrypted.';
    return "I'm here to help! Ask me about your order status, menu items, or how to use ZEfood. 🍽️";
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setMessages(p => [...p, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/chatbot/message', {
        method: 'POST',
        body: JSON.stringify({
          message: userMsg,
          session_id: 'session-1',
          order_context: currentOrder,
        }),
      });
      setMessages(p => [...p, { role: 'bot', text: res.response }]);
    } catch {
      // Demo fallback with order context awareness
      setTimeout(() => {
        setMessages(p => [...p, { role: 'bot', text: buildContextualResponse(userMsg) }]);
        setLoading(false);
      }, 700);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div style={{ fontSize: 26 }}>🤖</div>
            <div>
              <div className="chat-header-title">ZEfood Support</div>
              <div style={{ fontSize: 11, color: 'var(--success)' }}>● Online · AI-powered</div>
            </div>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text2)', fontSize: 18, cursor: 'pointer' }}
              onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Order context bar */}
          {hasOrderContext && (
            <div className="chat-context-bar">
              <span>📦</span>
              <span>Order {currentOrder.id} · {ORDER_STEPS.find(s => s.key === currentOrder.status)?.label || currentOrder.status}</span>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {loading && <div className="chat-msg bot" style={{ color: 'var(--text2)' }}>Typing…</div>}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <input id="chat-input" className="chat-input" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={hasOrderContext ? `Ask about order ${currentOrder.id}...` : 'Type a message...'} />
            <button id="chat-send-btn" className="chat-send" onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
      <button id="chat-widget-btn" className="chat-bubble" onClick={() => setOpen(o => !o)}>
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════
// Bottom Navigation
// ══════════════════════════════════════════════
function BottomNav({ active, onChange, cartCount }) {
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'cart', icon: '🛒', label: 'Cart' },
    { id: 'track', icon: '📦', label: 'Orders' },
    { id: 'review', icon: '⭐', label: 'Review' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];
  return (
    <div className="bottom-nav">
      {tabs.map(tab => (
        <button key={tab.id} id={`nav-${tab.id}`} className={`nav-btn ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}>
          <div style={{ position: 'relative' }}>
            <span className="nav-btn-icon">{tab.icon}</span>
            {tab.id === 'cart' && cartCount > 0 && (
              <span className="cart-badge">{cartCount}</span>
            )}
          </div>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// App Root
// ══════════════════════════════════════════════
export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zf_user')); } catch { return null; }
  });
  const [tab, setTab] = useState('home');
  const [cart, setCart] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(() => {
    const order = JSON.parse(localStorage.getItem('zf_current_order') || '{}');
    return order.id || null;
  });

  const handleLogin = async (email, password, name, mode) => {
    try {
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ firebase_id_token: `demo_${email}` }),
      });
      localStorage.setItem('zf_token', res.access_token);
      localStorage.setItem('zf_user', JSON.stringify(res.user));
      setUser(res.user);
      toast.success(`Welcome, ${res.user.name}! 🎉`);
    } catch {
      const mockUser = { uid: `user-${Date.now()}`, email, name: name || email.split('@')[0], role: 'customer' };
      localStorage.setItem('zf_token', 'demo-user-token');
      localStorage.setItem('zf_user', JSON.stringify(mockUser));
      setUser(mockUser);
      toast.success(`Welcome, ${mockUser.name}! 🎉`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zf_token');
    localStorage.removeItem('zf_user');
    setUser(null);
    setCart([]);
    toast('Signed out');
  };

  const handleOrderPlaced = (orderId) => {
    setActiveOrderId(orderId);
    setTab('track');
  };

  const toasterStyle = theme === 'dark'
    ? { background: '#13131e', color: '#eeeef5', border: '1px solid rgba(255,255,255,0.08)' }
    : { background: '#ffffff', color: '#111118', border: '1px solid rgba(0,0,0,0.08)' };

  if (!user) return (
    <>
      <LoginScreen onLogin={handleLogin} />
      <Toaster position="bottom-center" toastOptions={{ style: toasterStyle }} />
    </>
  );

  const renderScreen = () => {
    if (selectedRestaurant && tab === 'home') {
      return (
        <RestaurantScreen
          restaurant={selectedRestaurant}
          cart={cart}
          setCart={setCart}
          onBack={() => setSelectedRestaurant(null)}
        />
      );
    }
    switch (tab) {
      case 'home': return <HomeScreen cart={cart} setCart={setCart} onSelectRestaurant={r => setSelectedRestaurant(r)} />;
      case 'cart': return <CartScreen cart={cart} setCart={setCart} onOrderPlaced={handleOrderPlaced} />;
      case 'track': return <TrackingScreen orderId={activeOrderId} onStatusChange={() => {}} />;
      case 'review': return <ReviewScreen orderId={activeOrderId} />;
      case 'profile': return <ProfileScreen user={user} onLogout={handleLogout} />;
      default: return <HomeScreen cart={cart} setCart={setCart} onSelectRestaurant={setSelectedRestaurant} />;
    }
  };

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <>
      <header className="app-header">
        {selectedRestaurant && tab === 'home' ? null : (
          <>
            <div className="header-logo">ZEfood</div>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text2)', marginRight: 8 }}>📍 Bengaluru</div>
            <button id="theme-toggle-btn" className="theme-toggle" onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </>
        )}
      </header>

      {renderScreen()}

      <BottomNav
        active={tab}
        onChange={(t) => { setTab(t); if (t !== 'home') setSelectedRestaurant(null); }}
        cartCount={cartItemCount}
      />
      <ChatWidget />
      <Toaster
        position="bottom-center"
        toastOptions={{ style: { ...toasterStyle, marginBottom: '80px' } }}
      />
    </>
  );
}
