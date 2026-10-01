import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const FleetContext = createContext(null);

export const FleetProvider = ({ children }) => {
  const { user } = useAuth();
  const [fleet, setFleet] = useState([]);
  const [kpis, setKpis] = useState({ total: 0, running: 0, stopped: 0, offline: 0 });
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  // Auxiliary entities
  const [metadata, setMetadata] = useState({
    models: ['G11 (5023)', 'AQULA 140', 'Wetrack 140', 'Concox GT06N', 'Coban GPS103', 'Teltonika FMB920', 'VL02 4G'],
    categories: ['car', 'truck', 'motorcycle', 'bus', 'van', 'pickup', 'tractor', 'ambulance'],
    notifications: [],
    notificationTypes: []
  });
  const [allDevices, setAllDevices] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allGeofences, setAllGeofences] = useState([]);

  const ws = useRef(null);

  const loadTelemetryFeed = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch devices and positions directly for complete 100% reliable telemetry
      const [devRes, posRes] = await Promise.all([
        axios.get('/api/devices').catch(() => ({ data: [] })),
        axios.get('/api/positions').catch(() => ({ data: [] }))
      ]);

      const devices = Array.isArray(devRes.data) ? devRes.data : [];
      const positions = Array.isArray(posRes.data) ? posRes.data : [];

      if (devices.length > 0) {
        // Map positions by deviceId and by id
        const posByDevId = new Map();
        positions.forEach(p => {
          if (p.deviceId !== undefined && p.deviceId !== null) posByDevId.set(String(p.deviceId), p);
          if (p.id !== undefined && p.id !== null) posByDevId.set(String(p.id), p);
        });

        // Build unified fleet list for all devices (including all offline vehicles)
        const unifiedFleet = devices.map(d => {
          const p = posByDevId.get(String(d.id)) || (d.positionId ? posByDevId.get(String(d.positionId)) : null);
          
          // Determine status accurately from device status and telemetry
          const isDeviceOnline = d.status === 'online';
          let status = 'OFFLINE';
          if (isDeviceOnline) {
            if (p) {
              const spdKmh = Number(p.speed || 0) * 1.852;
              const hasMotion = p.attributes?.motion === true;
              const isIgnitionOn = p.attributes?.ignition === true;
              // Vehicle is running if moving >= 3 km/h or motion sensor active
              if (spdKmh >= 3 || (hasMotion && (spdKmh >= 1.5 || isIgnitionOn))) {
                status = 'RUNNING';
              } else {
                status = 'STOPPED';
              }
            } else {
              status = 'STOPPED';
            }
          } else {
            status = 'OFFLINE';
          }

          const positionObj = p ? {
            ...p,
            address: p.address || (p.latitude && p.longitude ? `${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}` : 'GPS Fix Active'),
            attributes: {
              ...(p.attributes || {}),
              currentStatus: status
            }
          } : {
            latitude: d.latitude || 28.6139,
            longitude: d.longitude || 77.2090,
            speed: 0,
            course: 0,
            address: d.address || (d.lastUpdate ? `Last active: ${new Date(d.lastUpdate).toLocaleTimeString('en-IN', { hour12: true })}` : 'Awaiting GPS Signal'),
            attributes: {
              ignition: false,
              motion: false,
              currentStatus: status
            }
          };

          return {
            device: d,
            position: positionObj
          };
        });

        let runCount = 0;
        let stopCount = 0;
        let offCount = 0;

        unifiedFleet.forEach(item => {
          const s = item.position?.attributes?.currentStatus;
          if (s === 'RUNNING') runCount++;
          else if (s === 'STOPPED') stopCount++;
          else offCount++;
        });

        setKpis({
          total: unifiedFleet.length,
          running: runCount,
          stopped: stopCount,
          offline: offCount
        });

        setFleet(unifiedFleet);
        setAllDevices(devices);
        return;
      }

      // Fallback if devices list is empty
      const userId = user.attributes?.adminId || user.id || '99686';
      const res = await axios.get(`/api/users/${userId}/userDevicesState?pieChartOnly=false`);
      const data = res.data;
      if (data) {
        setKpis({
          total: data.totalDevices?.count ?? 0,
          running: data.running?.count ?? 0,
          stopped: data.stopped?.count ?? 0,
          offline: (data.inactive?.count ?? 0) + (data.noData?.count ?? 0)
        });
        if (Array.isArray(data.deviceCumPositionList)) {
          setFleet(data.deviceCumPositionList);
        }
      }
    } catch (err) {
      console.error('Telemetry fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadAuxiliaryData = useCallback(async () => {
    if (!user) return;
    try {
      const [metaRes, grpRes, geoRes, devRes, usrRes] = await Promise.all([
        axios.get('/api/custom/metadata').catch(() => ({ data: {} })),
        axios.get('/api/groups').catch(() => ({ data: [] })),
        axios.get('/api/geofences').catch(() => ({ data: [] })),
        axios.get('/api/devices').catch(() => ({ data: [] })),
        axios.get('/api/users').catch(() => ({ data: [] }))
      ]);

      if (metaRes.data) {
        setMetadata(prev => ({
          models: metaRes.data.models?.length ? metaRes.data.models : prev.models,
          categories: metaRes.data.categories?.length ? metaRes.data.categories : prev.categories,
          notifications: metaRes.data.notifications || [],
          notificationTypes: metaRes.data.notificationTypes || []
        }));
      }
      if (Array.isArray(grpRes.data)) setAllGroups(grpRes.data);
      if (Array.isArray(geoRes.data)) setAllGeofences(geoRes.data);
      if (Array.isArray(devRes.data)) setAllDevices(devRes.data);
      if (Array.isArray(usrRes.data)) setAllUsers(usrRes.data);
    } catch (e) {
      console.error('Error loading auxiliary data:', e);
    }
  }, [user]);

  // Initial Load & 5-second polling
  useEffect(() => {
    if (!user) return;
    loadTelemetryFeed();
    loadAuxiliaryData();

    const timer = setInterval(() => {
      loadTelemetryFeed();
    }, 5000);

    return () => clearInterval(timer);
  }, [user, loadTelemetryFeed, loadAuxiliaryData]);

  // WebSocket Live Updates
  useEffect(() => {
    if (!user) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      return;
    }

    let reconnectTimer = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/socketEvents`;

      try {
        if (ws.current) {
          ws.current.close();
        }
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          setSocketConnected(true);
        };

        ws.current.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'SOCKET_STATUS') {
              setSocketConnected(data.connected);
            } else if (data.positions || data.devices) {
              loadTelemetryFeed();
            }
          } catch (err) {}
        };

        ws.current.onclose = () => {
          setSocketConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 5000);
        };

        ws.current.onerror = () => {
          setSocketConnected(false);
        };
      } catch (e) {
        reconnectTimer = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [user, loadTelemetryFeed]);

  return (
    <FleetContext.Provider
      value={{
        fleet,
        kpis,
        loading,
        socketConnected,
        loadTelemetryFeed,
        metadata,
        devices: allDevices,
        allDevices,
        allUsers,
        allGroups,
        allGeofences,
        loadAuxiliaryData
      }}
    >
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => useContext(FleetContext);
