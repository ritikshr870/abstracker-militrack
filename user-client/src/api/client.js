import axios from 'axios';

// Production Backend Endpoints
export const PRODUCTION_API_ORIGIN = 'https://track.abstracker.org';
export const PRODUCTION_WS_ORIGIN = 'wss://track.abstracker.org';

// Detect if running on browser under abstracker.org domain
export const isBrowserWeb = typeof window !== 'undefined' && 
  (window.location.hostname === 'track.abstracker.org' || window.location.hostname.endsWith('.abstracker.org'));

// In native Android APK (Capacitor webview at localhost / capacitor://), baseURL points to https://track.abstracker.org
export const API_BASE_URL = typeof window !== 'undefined'
  ? (isBrowserWeb ? '' : PRODUCTION_API_ORIGIN)
  : PRODUCTION_API_ORIGIN;

export const WS_BASE_URL = typeof window !== 'undefined'
  ? (isBrowserWeb
      ? ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host)
      : PRODUCTION_WS_ORIGIN)
  : PRODUCTION_WS_ORIGIN;

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
