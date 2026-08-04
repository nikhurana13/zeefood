import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children, apiBase = '' }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('zefood_token');
    const storedUser = localStorage.getItem('zefood_user');
    if (stored && storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch (_) {}
    }
    setLoading(false);
  }, []);

  const login = async (firebaseIdToken) => {
    const res = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebase_id_token: firebaseIdToken }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    localStorage.setItem('zefood_token', data.access_token);
    localStorage.setItem('zefood_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('zefood_token');
    localStorage.removeItem('zefood_user');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('zefood_token');

  return (
    <AuthContext.Provider value={{ user, login, logout, getToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
