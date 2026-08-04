import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import InventoryPage from './pages/InventoryPage';
import StaffPage from './pages/StaffPage';
import SentimentPage from './pages/SentimentPage';
import AnalyticsPage from './pages/AnalyticsPage';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/sentiment" element={<SentimentPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, login } = useAuth();

  const handleLogin = async (email, password) => {
    // Demo mode: skip Firebase, create a mock JWT call
    // In production: import Firebase, call signInWithEmailAndPassword, get ID token
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebase_id_token: `demo_${email}` }),
    }).catch(() => null);

    if (!res || !res.ok) {
      // Demo fallback
      localStorage.setItem('zefood_token', 'demo-token');
      localStorage.setItem('zefood_user', JSON.stringify({
        uid: 'demo-owner', email, name: 'Restaurant Owner', role: 'owner'
      }));
      window.location.reload();
      return;
    }
    const data = await res.json();
    localStorage.setItem('zefood_token', data.access_token);
    localStorage.setItem('zefood_user', JSON.stringify(data.user));
    window.location.reload();
  };

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
