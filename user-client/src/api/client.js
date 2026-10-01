import axios from 'axios';

// Hostinger / Production Ready API Client:
// Uses relative origin ('') so requests and session cookies flow directly through local Express / proxy
export const API_BASE_URL = '';
export const WS_BASE_URL = typeof window !== 'undefined'
  ? ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host)
  : '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Automatically attach user Auth header if logged in
api.interceptors.request.use((config) => {
  try {
    const authHeader = localStorage.getItem('abstracker_auth_header');
    if (authHeader) {
      config.headers['Authorization'] = authHeader;
    }
  } catch {}
  return config;
});
