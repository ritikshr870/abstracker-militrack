import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

axios.defaults.withCredentials = true;

// Register Service Worker for native WebAPK browser installation
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
