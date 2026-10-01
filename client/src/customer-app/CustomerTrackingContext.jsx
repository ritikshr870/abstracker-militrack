import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

const CustomerTrackingContext = createContext(null);

export function isValidLatLng(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function cleanAddress(addr, lat, lng, status) {
  if (addr && typeof addr === 'string' && addr.trim().length > 0) {
    let cleaned = addr.replace(/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}\s*,\s*/i, '');
    cleaned = cleaned.replace(/^[A-Z0-9]{4,}\+[A-Z0-9]{2,}[A-Za-z0-9\s]+,\s*/i, '');
    cleaned = cleaned.trim();
    if (cleaned.length > 5) return cleaned;
  }
  
  if (isValidLatLng(lat, lng)) {
    return `Patna Region (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  }

  if (status === 'offline') {
    return 'Parked / Standby (GPS in sleep mode)';
  }

  return 'GPS Location Active';
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
}

export function formatExactTime(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function CustomerTrackingProvider({ children }) {
  const [devicesMap, setDevicesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('abstracker_cached_devices');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [positionsMap, setPositionsMap] = useState(() => {
    try {
      const saved = localStorage.getItem('abstracker_cached_positions');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [loading, setLoading] = useState(() => Object.keys(devicesMap).length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCustomerLoggedOut, setIsCustomerLoggedOut] = useState(() => localStorage.getItem('abstracker_user_logged_out') === 'true');

  const socketRef = useRef(null);
  const pollTimerRef = useRef(null);

  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {}
  };

  const fetchData = async () => {
    if (localStorage.getItem('abstracker_user_logged_out') === 'true') {
      setIsCustomerLoggedOut(true);
      setLoading(false);
      return;
    }
    try {
      const [devRes, posRes] = await Promise.all([
        axios.get('/api/devices'),
        axios.get('/api/positions')
      ]);

      if (Array.isArray(devRes.data) && devRes.data.length > 0) {
        const dMap = {};
        devRes.data.forEach(d => { dMap[d.id] = d; });
        setDevicesMap(dMap);
        localStorage.setItem('abstracker_cached_devices', JSON.stringify(dMap));
      }

      if (Array.isArray(posRes.data) && posRes.data.length > 0) {
        const pMap = {};
        posRes.data.forEach(p => { 
          if (p.deviceId) pMap[p.deviceId] = p;
          if (p.id) pMap[p.id] = p;
        });
        setPositionsMap(pMap);
        localStorage.setItem('abstracker_cached_positions', JSON.stringify(pMap));
      }

      setLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.setItem('abstracker_user_logged_out', 'true');
        setIsCustomerLoggedOut(true);
      }
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  const fetchAlerts = async () => {
    try {
      const res = await axios.get('/api/notifications/logs');
      if (res.data && Array.isArray(res.data.logs) && res.data.logs.length > 0) {
        setAlerts(res.data.logs);
      }
    } catch {}
  };

  const handleCustomerLogout = async () => {
    try {
      await axios.delete('/api/session');
    } catch {}
    localStorage.removeItem('abstracker_cached_devices');
    localStorage.removeItem('abstracker_cached_positions');
    localStorage.setItem('abstracker_user_logged_out', 'true');
    setDevicesMap({});
    setPositionsMap({});
    setIsCustomerLoggedOut(true);
  };

  useEffect(() => {
    fetchData();
    fetchAlerts();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/socket`;

    function connectSocket() {
      try {
        if (socketRef.current) socketRef.current.close();
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => setIsSocketConnected(true);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.devices) {
              setDevicesMap(prev => {
                const updated = { ...prev };
                data.devices.forEach(d => { updated[d.id] = { ...updated[d.id], ...d }; });
                return updated;
              });
            }
            if (data.positions) {
              setPositionsMap(prev => {
                const updated = { ...prev };
                data.positions.forEach(p => { 
                  if (p.deviceId) updated[p.deviceId] = p; 
                  if (p.id) updated[p.id] = p;
                });
                return updated;
              });
            }
            if (data.events || data.type === 'LIVE_ALERT') {
              playAlertSound();
              const newAlert = data.alert || data.events?.[0];
              if (newAlert) {
                setAlerts(prev => [newAlert, ...prev].slice(0, 50));
              }
            }
          } catch {}
        };
        ws.onclose = () => {
          setIsSocketConnected(false);
          setTimeout(connectSocket, 5000);
        };
        ws.onerror = () => ws.close();
      } catch {}
    }

    connectSocket();
    pollTimerRef.current = setInterval(fetchData, 6000);

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const liveVehicles = useMemo(() => {
    // De-duplicate devices by normalized registration name
    // If multiple devices share the same vehicle plate (e.g. BR01), keep ONLY ONE (the online / latest updated one)
    const allDevs = Object.values(devicesMap);

    // Sort priority: online status first, then most recent lastUpdate
    const sortedDevs = [...allDevs].sort((a, b) => {
      const isOnlineA = a.status === 'online';
      const isOnlineB = b.status === 'online';
      if (isOnlineA && !isOnlineB) return -1;
      if (!isOnlineA && isOnlineB) return 1;

      const timeA = new Date(a.lastUpdate || 0).getTime();
      const timeB = new Date(b.lastUpdate || 0).getTime();
      return timeB - timeA;
    });

    const seenPlates = new Set();
    const deduplicatedDevs = [];

    sortedDevs.forEach(dev => {
      const plateKey = (dev.name || '').trim().toUpperCase();
      if (plateKey && seenPlates.has(plateKey)) {
        // Skip duplicate device for same vehicle registration number!
        return;
      }
      if (plateKey) {
        seenPlates.add(plateKey);
      }
      deduplicatedDevs.push(dev);
    });

    return deduplicatedDevs.map(dev => {
      const pos = positionsMap[dev.id] || (dev.positionId ? positionsMap[dev.positionId] : null) || {};
      const attrs = pos.attributes || {};

      let status = 'stopped';
      const isOnline = dev.status === 'online';

      if (!isOnline && dev.status === 'offline') {
        status = 'offline';
      } else if (attrs.currentStatus) {
        status = attrs.currentStatus.toLowerCase();
      } else if (pos.speed > 2) {
        status = 'running';
      } else if (attrs.ignition) {
        status = 'idle';
      } else {
        status = 'stopped';
      }

      const rawSpeed = pos.speed || 0;
      const speedKmh = Math.round(rawSpeed > 0 ? (pos.speedKmh ? parseFloat(pos.speedKmh) : rawSpeed * 1.852) : 0);
      const todayDistKm = (attrs.todayDistance ? (attrs.todayDistance / 1000).toFixed(1) : '0.0');
      const totalDistKm = (attrs.totalDistance ? (attrs.totalDistance / 1000).toFixed(0) : '0');
      const lastFixTime = pos.fixTime || pos.deviceTime || dev.lastUpdate || null;

      return {
        id: dev.id,
        name: dev.name || 'Vehicle',
        uniqueId: dev.uniqueId,
        category: dev.category || 'car',
        status: status,
        isOnline: isOnline,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: speedKmh,
        course: pos.course || 0,
        address: cleanAddress(pos.address, pos.latitude, pos.longitude, status),
        rawAddress: pos.address || '',
        ignition: attrs.ignition === true,
        battery: (() => {
          if (attrs.batteryLevel !== undefined) {
            const val = Number(attrs.batteryLevel);
            if (val > 100) return Math.min(100, Math.max(5, Math.round(((val - 3500) / 700) * 100)));
            return Math.min(100, Math.max(0, val));
          }
          if (attrs.battery !== undefined || pos.battery !== undefined) {
            const v = Number(attrs.battery || pos.battery);
            if (v > 20) return 100;
            if (v > 10) return Math.min(100, Math.max(5, Math.round(((v - 11.5) / 1.3) * 100)));
            if (v > 2) return Math.min(100, Math.max(5, Math.round(((v - 3.5) / 0.7) * 100)));
          }
          return 100;
        })(),
        todayDistance: todayDistKm,
        totalDistance: totalDistKm,
        lastUpdate: lastFixTime,
        relativeTime: formatRelativeTime(lastFixTime),
        exactTime: formatExactTime(lastFixTime),
        rawDevice: dev,
        rawPosition: pos
      };
    });
  }, [devicesMap, positionsMap]);

  const filteredVehicles = useMemo(() => {
    return liveVehicles.filter(v => {
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return v.name.toLowerCase().includes(q) || v.uniqueId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [liveVehicles, filterStatus, searchQuery]);

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return filteredVehicles[0] || liveVehicles[0] || null;
    return liveVehicles.find(v => v.id === selectedVehicleId) || null;
  }, [selectedVehicleId, liveVehicles, filteredVehicles]);

  const stats = useMemo(() => {
    let total = liveVehicles.length;
    let running = 0, stopped = 0, idle = 0, offline = 0;
    liveVehicles.forEach(v => {
      if (v.status === 'running') running++;
      else if (v.status === 'stopped') stopped++;
      else if (v.status === 'idle') idle++;
      else offline++;
    });
    return { total, running, stopped, idle, offline };
  }, [liveVehicles]);

  return (
    <CustomerTrackingContext.Provider value={{
      liveVehicles,
      devicesMap,
      positionsMap,
      filteredVehicles,
      selectedVehicle,
      setSelectedVehicleId,
      filterStatus,
      setFilterStatus,
      searchQuery,
      setSearchQuery,
      stats,
      loading,
      isRefreshing,
      handleManualRefresh,
      isSocketConnected,
      alerts,
      soundEnabled,
      setSoundEnabled,
      isCustomerLoggedOut,
      setIsCustomerLoggedOut,
      handleCustomerLogout,
      refreshData: fetchData
    }}>
      {children}
    </CustomerTrackingContext.Provider>
  );
}

export const useCustomerTracking = () => useContext(CustomerTrackingContext);
