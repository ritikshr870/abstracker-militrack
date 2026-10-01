import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('abstracker_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function initSession() {
      try {
        const res = await api.get('/api/session');
        if (isMounted && res.data && res.data.id) {
          setUser(res.data);
          localStorage.setItem('abstracker_user', JSON.stringify(res.data));
        } else if (isMounted) {
          setUser(null);
          localStorage.removeItem('abstracker_user');
          localStorage.removeItem('abstracker_auth_header');
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          localStorage.removeItem('abstracker_user');
          localStorage.removeItem('abstracker_auth_header');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    initSession();
    return () => { isMounted = false; };
  }, []);

  const login = async (email, password) => {
    localStorage.removeItem('abstracker_cached_devices');
    localStorage.removeItem('abstracker_cached_positions');
    localStorage.removeItem('abstracker_client_alerts');

    const authHeader = 'Basic ' + btoa(`${email}:${password}`);
    localStorage.setItem('abstracker_auth_header', authHeader);

    const res = await api.post('/api/session', { email, password }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });

    if (res.data && res.data.id) {
      setUser(res.data);
      localStorage.setItem('abstracker_user', JSON.stringify(res.data));
      return res.data;
    }
    throw new Error('Authentication failed');
  };

  const logout = async () => {
    try {
      await api.delete('/api/session');
    } catch {}
    setUser(null);
    localStorage.removeItem('abstracker_user');
    localStorage.removeItem('abstracker_auth_header');
    localStorage.removeItem('abstracker_cached_devices');
    localStorage.removeItem('abstracker_cached_positions');
    localStorage.removeItem('abstracker_client_alerts');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
