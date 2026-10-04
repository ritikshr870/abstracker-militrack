import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import './index.css';

axios.defaults.withCredentials = true;

// Configure Android & Native Status Bar to prevent screen cropping
if (Capacitor.isNativePlatform()) {
  try {
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setBackgroundColor({ color: '#FFFFFF' });
    StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    console.warn('[AbsTracker] StatusBar setup notice:', e);
  }
}

// Register PWA Service Worker for Offline Shell & Native Push Notifications (Browser environment)
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[AbsTracker] Telematics SW active with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[AbsTracker] SW registration warning:', err?.message || err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
