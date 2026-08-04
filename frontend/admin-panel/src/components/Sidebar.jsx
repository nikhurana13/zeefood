import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', icon: '📊', label: 'Dashboard', end: true },
  { path: '/orders', icon: '📦', label: 'Orders' },
  { path: '/inventory', icon: '🍽️', label: 'Inventory' },
  { path: '/staff', icon: '👥', label: 'Staff' },
  { path: '/sentiment', icon: '🧠', label: 'Sentiment Insights' },
  { path: '/analytics', icon: '📈', label: 'Demand Analytics' },
  { path: '/settings', icon: '⚙️', label: 'Settings' },
];

function useAdminTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('zf_admin_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zf_admin_theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

export default function Sidebar({ pendingItems = 0, newOrders = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useAdminTheme();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🍽️</div>
        <div>
          <div className="logo-text">ZEfood</div>
          <div className="logo-badge">Admin Panel</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {navItems.slice(0, 4).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.label === 'Orders' && newOrders > 0 && (
              <span className="nav-badge">{newOrders}</span>
            )}
            {item.label === 'Inventory' && pendingItems > 0 && (
              <span className="nav-badge">{pendingItems}</span>
            )}
          </NavLink>
        ))}

        <div className="nav-section-label">AI Insights</div>
        {navItems.slice(4, 6).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="nav-section-label">System</div>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⚙️</span>
          Settings
        </NavLink>
      </nav>

      {/* Theme Toggle */}
      <div className="theme-toggle-bar">
        <button
          id="admin-theme-toggle"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      {/* User Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0, color: 'white', fontFamily: 'var(--font-heading)', fontWeight: 700,
          }}>
            {user?.name?.[0]?.toUpperCase() || '👤'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }} className="truncate">
              {user?.role}
            </div>
          </div>
        </div>
        <button
          id="admin-logout-btn"
          onClick={handleLogout}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
