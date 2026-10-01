import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await axios.get('/api/session', { withCredentials: true });
      if (res.data && res.data.id) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const authHeader = 'Basic ' + btoa(`${email}:${password}`);
    const res = await axios.post('/api/session', { email, password }, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    if (res.data && res.data.id) {
      setUser(res.data);
      return res.data;
    }
    throw new Error('Authentication failed');
  };

  const logout = async () => {
    try {
      await axios.delete('/api/session', { withCredentials: true });
    } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
