import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

axios.defaults.withCredentials = true;

// Register PWA Service Worker for Offline Shell & Native Push Notifications
if ('serviceWorker' in navigator) {
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
