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
      const savedUser = localStorage.getItem('abstracker_user');
      const savedAuth = localStorage.getItem('abstracker_auth_header');
      let creds = null;
      try {
        const rawCreds = localStorage.getItem('abstracker_creds');
        if (rawCreds) {
          creds = JSON.parse(rawCreds);
        } else if (savedAuth && savedAuth.startsWith('Basic ')) {
          const raw = atob(savedAuth.replace('Basic ', '').trim());
          const colonIdx = raw.indexOf(':');
          if (colonIdx > 0) {
            creds = { email: raw.substring(0, colonIdx), password: raw.substring(colonIdx + 1) };
          }
        }
      } catch {}

      if (!savedUser && !savedAuth && !creds) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await api.get('/api/session');
        if (isMounted && res.data && res.data.id) {
          setUser(res.data);
          localStorage.setItem('abstracker_user', JSON.stringify(res.data));
          if (isMounted) setLoading(false);
          return;
        }
      } catch (err) {
        // If session GET failed with 401 or 404, try re-authenticating with saved credentials
        if (creds && creds.email && creds.password) {
          try {
            const authHeader = 'Basic ' + btoa(`${creds.email}:${creds.password}`);
            const reRes = await api.post('/api/session', { email: creds.email, password: creds.password }, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
              }
            });
            if (isMounted && reRes.data && reRes.data.id) {
              setUser(reRes.data);
              localStorage.setItem('abstracker_user', JSON.stringify(reRes.data));
              localStorage.setItem('abstracker_auth_header', authHeader);
              if (isMounted) setLoading(false);
              return;
            }
          } catch (reErr) {
            if (reErr.response && (reErr.response.status === 401 || reErr.response.status === 403)) {
              if (isMounted) {
                setUser(null);
                localStorage.removeItem('abstracker_user');
                localStorage.removeItem('abstracker_auth_header');
                localStorage.removeItem('abstracker_creds');
              }
            } else {
              // Network error or offline - retain local user session
              console.warn('[Auth] Server unreachable, keeping offline session active.');
            }
          }
        } else if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          if (isMounted) {
            setUser(null);
            localStorage.removeItem('abstracker_user');
            localStorage.removeItem('abstracker_auth_header');
          }
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
    localStorage.setItem('abstracker_creds', JSON.stringify({ email, password }));

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
    localStorage.removeItem('abstracker_creds');
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
