import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { api, WS_BASE_URL } from '../api/client';
import { useAuth, ensureNativeMonitoring } from './AuthContext';
import { sendPushNotification, speakVehicleAlert, requestNotificationPermission } from '../utils/notificationManager';

const TrackingContext = createContext(null);

export function TrackingProvider({ children }) {
  const { user } = useAuth();
  
  // Initialize with cached data from localStorage so UI NEVER flashes empty
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

  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('abstracker_client_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [loading, setLoading] = useState(() => Object.keys(devicesMap).length === 0);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const socketRef = useRef(null);
  const pollTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const lastVehiclesRef = useRef(null);
  const initialAlertsGeneratedRef = useRef(false);
  const prevIgnitionsRef = useRef({});

  // Clean vehicle plate and label parser to prevent repetitive text
  const parseVehicleNames = (dev) => {
    if (!dev) return { plate: 'Vehicle', label: '', display: 'Vehicle' };
    const rawName = (dev.name || '').trim();
    const attrs = dev.attributes || {};
    const attrPlate = (attrs.plateNumber || attrs.vehicleNo || attrs.registrationNumber || '').trim();

    // Check if name has format like "BE25PA0494(UDASNU-THANA)" or "BR01PM2106 (TOWN THANA)"
    const match = rawName.match(/^([A-Z0-9\-_]+)\s*\((.*?)\)$/i);
    if (match) {
      const p = match[1].trim();
      const l = match[2].trim();
      return { plate: p, label: l, display: `${p} (${l})` };
    }

    if (attrPlate && attrPlate !== rawName && !rawName.includes(attrPlate)) {
      return { plate: attrPlate, label: rawName, display: `${attrPlate} (${rawName})` };
    }

    return { plate: attrPlate || rawName || 'Vehicle', label: '', display: rawName || 'Vehicle' };
  };

  const getVehicleIdentifier = (dev) => {
    return parseVehicleNames(dev).display;
  };

  // Helper to detect ignition state transitions and speak "Engine On" / "Engine Off" with clean vehicle plate
  const checkIgnitionChanges = (positionsList) => {
    if (!Array.isArray(positionsList)) return;
    positionsList.forEach(p => {
      if (!p || !p.deviceId) return;
      const devId = p.deviceId;
      const dev = devicesMap[devId];
      const { plate, label, display } = parseVehicleNames(dev);
      const isIgnOn = p.attributes?.ignition === true || p.ignition === true;
      const prev = prevIgnitionsRef.current[devId];

      if (prev !== undefined && prev !== isIgnOn) {
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const spoken = `${plate} Engine ${isIgnOn ? 'On' : 'Off'}`;
        const title = `[${plate}] Engine ${isIgnOn ? 'ON' : 'OFF'}`;
        const body = `${label ? label + ': ' : ''}Ignition switched ${isIgnOn ? 'ON' : 'OFF'} at ${timeStr}.`;

        speakVehicleAlert(spoken);
        sendPushNotification(title, {
          body: body,
          tag: `ign-${isIgnOn ? 'on' : 'off'}-${devId}-${Date.now()}`,
          url: '/app/map'
        });
      }
      prevIgnitionsRef.current[devId] = isIgnOn;
    });
  };

  // Sound chime
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

  // Robust data fetching with auto-retry and persistent caching
  const fetchData = async () => {
    try {
      const [devRes, posRes] = await Promise.all([
        api.get('/api/devices'),
        api.get('/api/positions')
      ]);

      if (Array.isArray(devRes.data) && devRes.data.length > 0) {
        const dMap = {};
        devRes.data.forEach(d => { dMap[d.id] = d; });
        setDevicesMap(dMap);
        localStorage.setItem('abstracker_cached_devices', JSON.stringify(dMap));
      }

      if (Array.isArray(posRes.data) && posRes.data.length > 0) {
        const pMap = {};
        posRes.data.forEach(p => { pMap[p.deviceId] = p; });
        setPositionsMap(pMap);
        checkIgnitionChanges(posRes.data);
        localStorage.setItem('abstracker_cached_positions', JSON.stringify(pMap));
      }

      retryCountRef.current = 0;
      setLoading(false);
    } catch (err) {
      console.warn('Vehicle data fetch attempt failed:', err.message);
      if (Object.keys(devicesMap).length === 0 && retryCountRef.current < 4) {
        retryCountRef.current++;
        setTimeout(fetchData, 2000);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchUpstreamNotifications = async () => {
    try {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      let eventsData = [];
      try {
        const eventsRes = await api.get('/api/reports/events', { params: { from, to } });
        if (Array.isArray(eventsRes.data) && eventsRes.data.length > 0) {
          eventsData = eventsRes.data;
        }
      } catch {}

      if (eventsData.length === 0) {
        try {
          const notifRes = await api.get('/api/notifications');
          if (Array.isArray(notifRes.data)) {
            eventsData = notifRes.data;
          }
        } catch {}
      }

      if (eventsData.length > 0) {
        const mapped = eventsData.map((n, i) => {
          const dev = devicesMap[n.deviceId] || {};
          const { plate, label, display } = parseVehicleNames(dev);
          const tLower = (n.type || '').toLowerCase();
          const isIgnOn = tLower.includes('ignon') || tLower === 'ignitionon';
          const isIgnOff = tLower.includes('ignoff') || tLower === 'ignitionoff';
          const isSpeed = tLower.includes('speed') || tLower.includes('overspeed');

          let cleanTitle = `[${plate}] Telematics Event`;
          let cleanMessage = `${label ? label + ': ' : ''}Event recorded`;
          let catType = 'alarm';

          if (isIgnOn) {
            cleanTitle = `[${plate}] Engine ON`;
            cleanMessage = `${label ? label + ': ' : ''}Vehicle ignition switched ON.`;
            catType = 'ignition';
          } else if (isIgnOff) {
            cleanTitle = `[${plate}] Engine OFF`;
            cleanMessage = `${label ? label + ': ' : ''}Vehicle parked and ignition turned OFF.`;
            catType = 'ignition';
          } else if (isSpeed) {
            cleanTitle = `[${plate}] Overspeed Warning`;
            cleanMessage = `${label ? label + ': ' : ''}Vehicle exceeded preset speed threshold.`;
            catType = 'alarm';
          }

          return {
            id: n.id ? `ev-${n.id}` : `ev-${i}`,
            deviceId: n.deviceId,
            vehicleName: display,
            vehiclePlate: plate,
            category: dev.category || 'car',
            type: n.type || 'alarm',
            categoryType: catType,
            title: cleanTitle,
            message: n.description || cleanMessage,
            address: positionsMap[n.deviceId]?.address || 'Live GPS Coordinates',
            severity: isIgnOff ? 'danger' : (isIgnOn ? 'info' : 'warning'),
            time: n.eventTime || n.serverTime || new Date().toISOString()
          };
        });

        setAlerts(prev => {
          const ids = new Set(prev.map(a => a.id));
          const toAdd = mapped.filter(m => !ids.has(m.id));
          if (toAdd.length > 0) {
            const combined = [...toAdd, ...prev].slice(0, 100);
            try { localStorage.setItem('abstracker_client_alerts', JSON.stringify(combined)); } catch {}
            return combined;
          }
          return prev;
        });
      }
    } catch {}
  };

  const syncNativeBackgroundAlerts = () => {
    try {
      if (typeof window !== 'undefined' && window.AndroidNative && window.AndroidNative.getBackgroundAlerts) {
        const raw = window.AndroidNative.getBackgroundAlerts();
        if (raw) {
          const bgList = JSON.parse(raw);
          if (Array.isArray(bgList) && bgList.length > 0) {
            setAlerts(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const newAlerts = bgList.filter(b => !existingIds.has(b.id));
              if (newAlerts.length > 0) {
                const combined = [...newAlerts, ...prev].slice(0, 100);
                try { localStorage.setItem('abstracker_client_alerts', JSON.stringify(combined)); } catch {}
                return combined;
              }
              return prev;
            });
            window.AndroidNative.clearBackgroundAlerts();
          }
        }
      }
    } catch (err) {
      console.warn('Native background alerts sync error:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      setDevicesMap({});
      setPositionsMap({});
      setAlerts([]);
      return;
    }

    // Auto-request push notification permission without requiring manual user modal click
    try {
      requestNotificationPermission().catch(() => {});
    } catch {}

    ensureNativeMonitoring();
    fetchData();
    fetchUpstreamNotifications();
    syncNativeBackgroundAlerts();

    // WebSocket real-time updates
    function connectSocket() {
      try {
        if (socketRef.current) socketRef.current.close();
        const ws = new WebSocket(`${WS_BASE_URL}/api/socket`);
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
                data.positions.forEach(p => { updated[p.deviceId] = p; });
                return updated;
              });
              checkIgnitionChanges(data.positions);
            }
            if (data.events && Array.isArray(data.events)) {
              const incoming = data.events.map(ev => {
                const dev = devicesMap[ev.deviceId] || {};
                const pos = positionsMap[ev.deviceId] || {};
                const { plate, label, display } = parseVehicleNames(dev);
                const isIgn = ev.type?.toLowerCase().includes('ignition');
                return {
                  id: ev.id ? `ws-${ev.id}` : `ws-${Date.now()}-${Math.random()}`,
                  deviceId: ev.deviceId,
                  vehicleName: display,
                  vehiclePlate: plate,
                  category: dev.category || 'car',
                  type: ev.type || 'alarm',
                  categoryType: isIgn ? 'ignition' : (ev.type?.toLowerCase().includes('overspeed') ? 'alarm' : 'movement'),
                  title: `[${plate}] ${ev.type ? ev.type.replace(/([A-Z])/g, ' $1').trim() : 'Telematics Event'}`,
                  message: `${label ? label + ': ' : ''}Alert recorded on ${plate}`,
                  address: pos.address || 'GPS Coordinates',
                  severity: isIgn ? 'info' : 'danger',
                  time: ev.eventTime || new Date().toISOString()
                };
              });
              playAlertSound();
              incoming.forEach(alertItem => {
                try {
                  sendPushNotification(alertItem.title, {
                    body: alertItem.message,
                    tag: alertItem.id,
                    url: '/app/alerts'
                  });

                  // Spoken Voice Announcements ("Engine On", "Engine Off", "Overspeed")
                  const tLower = (alertItem.type || '').toLowerCase();
                  const titLower = (alertItem.title || '').toLowerCase();
                  if (tLower.includes('ignition') || titLower.includes('ignition')) {
                    if (tLower.includes('off') || titLower.includes('off')) {
                      speakVehicleAlert(`${alertItem.vehiclePlate} Engine Off`);
                    } else {
                      speakVehicleAlert(`${alertItem.vehiclePlate} Engine On`);
                    }
                  } else if (tLower.includes('overspeed') || titLower.includes('overspeed')) {
                    speakVehicleAlert(`Warning, ${alertItem.vehiclePlate} Overspeed`);
                  } else if (alertItem.severity === 'danger' || tLower.includes('alarm')) {
                    speakVehicleAlert(`Alert on ${alertItem.vehiclePlate}`);
                  }
                } catch (e) {}
              });
              setAlerts(prev => {
                const combined = [...incoming, ...prev].slice(0, 100);
                try { localStorage.setItem('abstracker_client_alerts', JSON.stringify(combined)); } catch {}
                return combined;
              });
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
    pollTimerRef.current = setInterval(() => {
      fetchData();
      syncNativeBackgroundAlerts();
    }, 8000);

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [user?.id]);

  // Enriched vehicles with consistent status normalisation
  const liveVehicles = useMemo(() => {
    return Object.values(devicesMap).map(dev => {
      const pos = positionsMap[dev.id] || {};
      const attrs = pos.attributes || {};

      let status = 'parked';
      const isOnline = dev.status === 'online';

      if (!isOnline && dev.status === 'offline') {
        status = 'offline';
      } else if (attrs.currentStatus) {
        const cs = attrs.currentStatus.toLowerCase();
        if (cs === 'moving' || cs === 'running') status = 'running';
        else if (cs === 'idle' || cs === 'idling') status = 'idle';
        else if (cs === 'stopped' || cs === 'parked') status = 'parked';
        else if (cs === 'offline') status = 'offline';
        else status = cs;
      } else if (pos.speed > 2) {
        status = 'running';
      } else if (attrs.ignition === true || pos.ignition === true) {
        status = 'idle';
      } else {
        status = 'parked';
      }

      const rawSpeed = pos.speed || 0;
      const speedKmh = Math.round(rawSpeed > 0 ? (pos.speedKmh ? parseFloat(pos.speedKmh) : rawSpeed * 1.852) : 0);
      const todayDistKm = (attrs.todayDistance ? (attrs.todayDistance / 1000).toFixed(1) : '0.0');
      const totalDistKm = (attrs.totalDistance ? (attrs.totalDistance / 1000).toFixed(0) : '0');

      return {
        id: dev.id,
        name: dev.name || 'Vehicle',
        uniqueId: dev.uniqueId,
        plateNumber: getVehicleIdentifier(dev),
        category: dev.category || 'car',
        status: status,
        isOnline: isOnline,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: speedKmh,
        course: pos.course || 0,
        address: pos.address || 'Address updating...',
        ignition: attrs.ignition === true || pos.ignition === true,
        battery: attrs.batteryLevel || pos.battery || 100,
        todayDistance: todayDistKm,
        totalDistance: totalDistKm,
        lastUpdate: pos.fixTime || pos.deviceTime || pos.serverTime || dev.lastUpdate || null,
        serverTime: pos.serverTime || dev.lastUpdate || null,
        rawDevice: dev,
        rawPosition: pos
      };
    });
  }, [devicesMap, positionsMap]);

  // Real-time telematics alert generation engine
  useEffect(() => {
    if (!liveVehicles || liveVehicles.length === 0) return;

    const newAlerts = [];
    const nowIso = new Date().toISOString();

    if (!lastVehiclesRef.current) {
      // First boot: if alerts are completely empty, synthesize initial real vehicle status records
      if (alerts.length === 0 && !initialAlertsGeneratedRef.current) {
        initialAlertsGeneratedRef.current = true;
        liveVehicles.forEach(v => {
          if (v.status === 'running') {
            newAlerts.push({
              id: `alert-init-${v.id}-mov`,
              deviceId: v.id,
              vehicleName: v.name,
              vehiclePlate: v.uniqueId,
              category: v.category,
              type: 'moving',
              categoryType: 'movement',
              title: 'Vehicle in Motion',
              message: `${v.name} is running at ${v.speed} km/h`,
              address: v.address || 'GPS Live Coordinates',
              severity: 'info',
              time: nowIso
            });
          } else if (v.status === 'idle') {
            newAlerts.push({
              id: `alert-init-${v.id}-idle`,
              deviceId: v.id,
              vehicleName: v.name,
              vehiclePlate: v.uniqueId,
              category: v.category,
              type: 'idle',
              categoryType: 'movement',
              title: 'Vehicle Idling',
              message: `${v.name} is idling with ignition ON`,
              address: v.address || 'GPS Live Coordinates',
              severity: 'warning',
              time: nowIso
            });
          } else if (v.status === 'offline') {
            newAlerts.push({
              id: `alert-init-${v.id}-off`,
              deviceId: v.id,
              vehicleName: v.name,
              vehiclePlate: v.uniqueId,
              category: v.category,
              type: 'offline',
              categoryType: 'system',
              title: 'Tracker Offline',
              message: `${v.name} GPS hardware is currently offline`,
              address: v.address || 'Last Known Location',
              severity: 'warning',
              time: nowIso
            });
          } else {
            newAlerts.push({
              id: `alert-init-${v.id}-park`,
              deviceId: v.id,
              vehicleName: v.name,
              vehiclePlate: v.uniqueId,
              category: v.category,
              type: 'ignition_off',
              categoryType: 'ignition',
              title: 'Vehicle Parked & Secure',
              message: `${v.name} parked safely, engine OFF`,
              address: v.address || 'Last Known Location',
              severity: 'info',
              time: nowIso
            });
          }

          if (v.battery > 0 && v.battery <= 20) {
            newAlerts.push({
              id: `alert-init-${v.id}-bat`,
              deviceId: v.id,
              vehicleName: v.name,
              vehiclePlate: v.uniqueId,
              category: v.category,
              type: 'low_battery',
              categoryType: 'alarm',
              title: 'Low Battery Warning',
              message: `${v.name} backup battery at ${v.battery}%`,
              address: v.address || 'GPS Live Coordinates',
              severity: 'danger',
              time: nowIso
            });
          }
        });
      }
    } else {
      // Compare current vehicle states with previous states
      const prevMap = lastVehiclesRef.current;
      liveVehicles.forEach(v => {
        const prev = prevMap[v.id];
        if (!prev) return;

        // 1. Ignition Turned ON
        if (!prev.ignition && v.ignition) {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-ignon`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'ignition_on',
            categoryType: 'ignition',
            title: 'Ignition Switched ON',
            message: `${v.name} engine started`,
            address: v.address || 'GPS Live Coordinates',
            severity: 'success',
            time: nowIso
          });
        }
        // 2. Ignition Turned OFF
        else if (prev.ignition && !v.ignition) {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-ignoff`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'ignition_off',
            categoryType: 'ignition',
            title: 'Ignition Switched OFF',
            message: `${v.name} engine stopped (Parked)`,
            address: v.address || 'GPS Live Coordinates',
            severity: 'info',
            time: nowIso
          });
        }

        // 3. Overspeed Warning (> 60 km/h)
        if (v.speed >= 60 && prev.speed < 60) {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-speed`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'overspeed',
            categoryType: 'alarm',
            title: `Overspeed Alert (${v.speed} km/h)`,
            message: `${v.name} exceeded safety speed limit at ${v.speed} km/h`,
            address: v.address || 'GPS Live Coordinates',
            severity: 'danger',
            time: nowIso
          });
        }

        // 4. Vehicle Started Moving
        if (prev.status !== 'running' && v.status === 'running') {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-mov`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'moving',
            categoryType: 'movement',
            title: 'Vehicle Started Moving',
            message: `${v.name} started trip at ${v.speed} km/h`,
            address: v.address || 'GPS Live Coordinates',
            severity: 'info',
            time: nowIso
          });
        }

        // 5. Vehicle Idling
        if (prev.status !== 'idle' && v.status === 'idle') {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-idle`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'idle',
            categoryType: 'movement',
            title: 'Vehicle Idling Alert',
            message: `${v.name} is stationary with engine running`,
            address: v.address || 'GPS Live Coordinates',
            severity: 'warning',
            time: nowIso
          });
        }

        // 6. Device went offline
        if (prev.status !== 'offline' && v.status === 'offline') {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-off`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'offline',
            categoryType: 'system',
            title: 'GPS Tracker Offline',
            message: `${v.name} tracker lost signal connection`,
            address: v.address || 'Last Known Location',
            severity: 'warning',
            time: nowIso
          });
        }

        // 7. Low Battery Warning
        if (v.battery <= 20 && v.battery > 0 && prev.battery > 20) {
          newAlerts.push({
            id: `alert-${Date.now()}-${v.id}-bat`,
            deviceId: v.id,
            vehicleName: v.name,
            vehiclePlate: v.uniqueId,
            category: v.category,
            type: 'low_battery',
            categoryType: 'alarm',
            title: 'Low Battery Alert',
            message: `${v.name} internal battery is critically low (${v.battery}%)`,
            address: v.address || 'GPS Live Coordinates',
            severity: 'danger',
            time: nowIso
          });
        }
      });
    }

    // Save map for next diff
    const map = {};
    liveVehicles.forEach(v => { map[v.id] = { ...v }; });
    lastVehiclesRef.current = map;

    if (newAlerts.length > 0) {
      if (lastVehiclesRef.current) {
        playAlertSound();
      }
      setAlerts(prev => {
        const combined = [...newAlerts, ...prev].slice(0, 100);
        try { localStorage.setItem('abstracker_client_alerts', JSON.stringify(combined)); } catch {}
        return combined;
      });
    }
  }, [liveVehicles]);

  const clearAlerts = () => {
    setAlerts([]);
    try { localStorage.removeItem('abstracker_client_alerts'); } catch {}
  };

  const deleteAlert = (alertId) => {
    setAlerts(prev => {
      const updated = prev.filter(a => a.id !== alertId);
      try { localStorage.setItem('abstracker_client_alerts', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // Comprehensive stats covering running, not_moving, idle, parked, offline
  const stats = useMemo(() => {
    let total = liveVehicles.length;
    let running = 0, not_moving = 0, idle = 0, parked = 0, offline = 0;
    liveVehicles.forEach(v => {
      if (v.status === 'running') {
        running++;
      } else if (v.status === 'idle') {
        idle++;
        not_moving++;
      } else if (v.status === 'offline') {
        offline++;
        not_moving++;
      } else {
        // parked / stopped
        parked++;
        not_moving++;
      }
    });
    return {
      total,
      running,
      not_moving,
      idle,
      parked,
      stopped: parked,
      offline
    };
  }, [liveVehicles]);

  // Comprehensive multi-status filtering
  const filteredVehicles = useMemo(() => {
    return liveVehicles.filter(v => {
      if (filterStatus === 'running' && v.status !== 'running') return false;
      if (filterStatus === 'not_moving' && v.status === 'running') return false;
      if (filterStatus === 'idle' && v.status !== 'idle') return false;
      if (filterStatus === 'parked' && v.status !== 'parked' && v.status !== 'stopped') return false;
      if (filterStatus === 'stopped' && v.status !== 'parked' && v.status !== 'stopped') return false;
      if (filterStatus === 'offline' && v.status !== 'offline') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = v.name && v.name.toLowerCase().includes(q);
        const matchPlate = v.uniqueId && v.uniqueId.toLowerCase().includes(q);
        const matchAddr = v.address && v.address.toLowerCase().includes(q);
        return matchName || matchPlate || matchAddr;
      }
      return true;
    });
  }, [liveVehicles, filterStatus, searchQuery]);

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return filteredVehicles[0] || liveVehicles[0] || null;
    return liveVehicles.find(v => v.id === selectedVehicleId) || null;
  }, [selectedVehicleId, liveVehicles, filteredVehicles]);

  return (
    <TrackingContext.Provider value={{
      liveVehicles,
      filteredVehicles,
      selectedVehicle,
      setSelectedVehicleId,
      filterStatus,
      setFilterStatus,
      searchQuery,
      setSearchQuery,
      stats,
      loading,
      isSocketConnected,
      alerts,
      soundEnabled,
      setSoundEnabled,
      clearAlerts,
      deleteAlert,
      refreshData: fetchData
    }}>
      {children}
    </TrackingContext.Provider>
  );
}

export const useTracking = () => useContext(TrackingContext);
