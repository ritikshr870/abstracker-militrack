import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Polyline, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Play, Pause, Search, Navigation, Compass, MapPin, 
  Layers, Maximize2, Minimize2, SkipBack, SkipForward, RotateCcw, 
  Gauge, Radio, Clock, Eye 
} from 'lucide-react';
import axios from 'axios';
import { createDirectionalVehicleIcon, calculateBearing, createWaypointIcon } from './VehicleIcons';

function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getCompassDirection(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const ix = Math.round(deg / 22.5) % 16;
  return dirs[ix] || 'N';
}

const TILE_PROVIDERS = {
  googleStreets: {
    name: 'Google Streets HD (Full Roads & Places)',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 21,
    attribution: '&copy; Google Maps'
  },
  googleHybrid: {
    name: 'Google Satellite & Roads HD',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 21,
    attribution: '&copy; Google Maps'
  },
  osm: {
    name: 'OpenStreetMap Standard Atlas',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }
};

// Map Center & bounds hook with guaranteed tile rendering
function MapController({ center, bounds, isPlaying, isFullscreen }) {
  const map = useMap();

  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, isFullscreen]);

  useEffect(() => {
    if (bounds && bounds.length > 0 && !isPlaying) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60] });
    } else if (center) {
      map.panTo(center, { animate: true, duration: 0.25 });
    }
  }, [center, bounds, isPlaying, map]);
  return null;
}

const formatDateTimeInput = (dateObj) => {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
};

export default function MapModal({ vehicle, onClose }) {
  const d = vehicle?.device || vehicle || {};
  const p = vehicle?.position || {};
  const deviceId = d.id || vehicle?.id || vehicle?.deviceId;

  const [routePoints, setRoutePoints] = useState([]);
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Map tile layer mode & fullscreen - default to Google Streets HD
  const [activeLayer, setActiveLayer] = useState('googleStreets');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Playback state - Default speed 1x
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const intervalRef = useRef(null);

  const isVehicleMoving = (p.attributes?.currentStatus || d.status || '').toUpperCase() === 'RUNNING' || Number(p.speed || 0) * 1.852 >= 2;
  const [isLiveStream, setIsLiveStream] = useState(isVehicleMoving);

  // CRITICAL: Wipe old route immediately whenever vehicle changes!
  useEffect(() => {
    setRoutePoints([]);
    setPlaybackIndex(0);
    setIsPlaying(false);
    setLiveTelemetry(null);
    setResolvedAddress('');
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [deviceId]);

  // Initialize dates: start of today to now
  useEffect(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    setFromTime(formatDateTimeInput(startOfDay));
    setToTime(formatDateTimeInput(now));
  }, [deviceId]);

  // Live GPS tracking stream for running vehicles (DO NOT draw trailing path line)
  useEffect(() => {
    if (!isLiveStream || !deviceId || isPlaying) return;

    const liveTimer = setInterval(async () => {
      try {
        const res = await axios.get(`/api/positions?deviceId=${deviceId}`);
        const posData = Array.isArray(res.data) ? res.data[res.data.length - 1] : res.data;
        if (posData && posData.latitude && posData.longitude) {
          const lat = Number(posData.latitude);
          const lng = Number(posData.longitude);
          const spd = Math.round(Number(posData.speed || 0) * (posData.speedKmh ? 1 : 1.852));
          const crs = posData.course || 0;
          const time = posData.formattedTime || new Date().toLocaleTimeString('en-IN');

          // Update live telemetry only — do NOT add to routePoints (no trailing line)
          setLiveTelemetry({ lat, lng, speed: spd, course: crs, time });
        }
      } catch (e) {}
    }, 3500);

    return () => clearInterval(liveTimer);
  }, [isLiveStream, deviceId, isPlaying]);

  const fetchRoute = async () => {
    if (!deviceId) {
      alert('Invalid device reference');
      return;
    }
    if (!fromTime || !toTime) {
      alert('Please specify both From and To timestamps.');
      return;
    }

    setLoadingRoute(true);
    try {
      const fromIso = new Date(fromTime).toISOString();
      const toIso = new Date(toTime).toISOString();
      const res = await axios.get(`/api/positions?deviceId=${deviceId}&from=${fromIso}&to=${toIso}`);

      const positions = res.data || [];
      if (!positions || positions.length === 0) {
        alert('No movement positions recorded for the selected time range.');
        setRoutePoints([]);
        setLoadingRoute(false);
        return;
      }

      positions.sort((a, b) => {
        return new Date(a.fixTime || a.deviceTime).getTime() - new Date(b.fixTime || b.deviceTime).getTime();
      });

      // Filter stationary duplicates
      const filtered = [];
      let lastPt = null;
      positions.forEach(item => {
        const lat = Number(item.latitude || item.lat);
        const lng = Number(item.longitude || item.lng);
        if (!lat || !lng) return;

        if (!lastPt || (Math.abs(lat - lastPt.lat) > 0.00002 || Math.abs(lng - lastPt.lng) > 0.00002)) {
          const pt = {
            lat,
            lng,
            speed: Math.round(Number(item.speed || 0) * (item.speedKmh ? 1 : 1.852)),
            course: item.course || 0,
            time: item.formattedTime || item.deviceTime || item.fixTime || ''
          };
          filtered.push(pt);
          lastPt = pt;
        }
      });

      if (filtered.length === 0) {
        alert('No distinct coordinates found in telemetry log.');
      }

      setRoutePoints(filtered);
      setPlaybackIndex(0);
      setIsPlaying(false);
      clearInterval(intervalRef.current);
    } catch (err) {
      console.error(err);
      alert('Unable to load route points from engine server');
    } finally {
      setLoadingRoute(false);
    }
  };

  const togglePlayback = () => {
    if (routePoints.length === 0) {
      alert('Please load route coordinates first.');
      return;
    }

    if (isPlaying) {
      clearInterval(intervalRef.current);
      setIsPlaying(false);
    } else {
      if (playbackIndex >= routePoints.length - 1) {
        setPlaybackIndex(0);
      }
      setIsPlaying(true);

      const speedInterval = Math.max(25, 300 / playbackSpeed);
      intervalRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= routePoints.length - 1) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedInterval);
    }
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      clearInterval(intervalRef.current);
      const speedInterval = Math.max(25, 300 / playbackSpeed);
      intervalRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= routePoints.length - 1) {
            clearInterval(intervalRef.current);
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, speedInterval);
    }
  }, [playbackSpeed, isPlaying, routePoints.length]);

  const onSeek = (val) => {
    setPlaybackIndex(Number(val));
  };

  const stepForward = () => {
    if (playbackIndex < routePoints.length - 1) {
      setPlaybackIndex(prev => prev + 1);
    }
  };

  const stepBackward = () => {
    if (playbackIndex > 0) {
      setPlaybackIndex(prev => prev - 1);
    }
  };

  const resetPlayback = () => {
    setIsPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPlaybackIndex(0);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForward();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepBackward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, routePoints.length, playbackIndex]);

  // Distance calculations
  const { totalDistanceKm, currentDistanceKm } = useMemo(() => {
    if (routePoints.length < 2) return { totalDistanceKm: 0, currentDistanceKm: 0 };
    let total = 0;
    let current = 0;
    for (let i = 1; i < routePoints.length; i++) {
      const dKm = getHaversineDistanceKm(
        routePoints[i - 1].lat, routePoints[i - 1].lng,
        routePoints[i].lat, routePoints[i].lng
      );
      total += dKm;
      if (i <= playbackIndex) {
        current += dKm;
      }
    }
    return {
      totalDistanceKm: Number(total.toFixed(2)),
      currentDistanceKm: Number(current.toFixed(2))
    };
  }, [routePoints, playbackIndex]);

  // Determine current active point
  let activePt = null;
  let activeBearing = 0;
  let activeSpeed = 0;
  let activeTime = '--:--:--';

  if (routePoints.length > 0) {
    activePt = routePoints[playbackIndex] || routePoints[0];
    activeSpeed = activePt.speed;
    activeTime = activePt.time ? new Date(activePt.time).toLocaleString('en-IN', { hour12: true }) : '--:--:--';

    if (playbackIndex < routePoints.length - 1) {
      const nextPt = routePoints[playbackIndex + 1];
      activeBearing = calculateBearing(activePt.lat, activePt.lng, nextPt.lat, nextPt.lng);
    } else {
      activeBearing = activePt.course || 0;
    }
  } else if (liveTelemetry) {
    activePt = { lat: liveTelemetry.lat, lng: liveTelemetry.lng };
    activeBearing = liveTelemetry.course || 0;
    activeSpeed = liveTelemetry.speed || 0;
    activeTime = liveTelemetry.time || 'Live';
  } else if (p.latitude && p.longitude) {
    activePt = { lat: Number(p.latitude), lng: Number(p.longitude) };
    activeBearing = p.course || 0;
    activeSpeed = Math.round((p.speed || 0) * 1.852);
    activeTime = d.lastUpdate ? new Date(d.lastUpdate).toLocaleString('en-IN', { hour12: true }) : 'Live';
  }

  const centerLatLng = activePt ? [activePt.lat, activePt.lng] : [24.6754, 84.5358];

  // Live reverse geocoding to display place name, road name, district, and town
  useEffect(() => {
    if (!activePt?.lat || !activePt?.lng) return;

    let cancel = false;
    const fetchAddress = async () => {
      try {
        const res = await axios.get(`/api/map/reverse-geocode?lat=${activePt.lat}&lng=${activePt.lng}`);
        if (!cancel && res.data?.address) {
          setResolvedAddress(res.data.address);
        }
      } catch (e) {}
    };

    fetchAddress();
    return () => { cancel = true; };
  }, [activePt?.lat, activePt?.lng]);

  // Smooth continuous gliding position for 60fps moving vehicle
  const [animatedPos, setAnimatedPos] = useState(centerLatLng);
  const [animatedBearing, setAnimatedBearing] = useState(activeBearing);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!activePt) return;
    const targetPos = [activePt.lat, activePt.lng];
    const targetBearing = activeBearing;

    if (!animatedPos) {
      setAnimatedPos(targetPos);
      setAnimatedBearing(targetBearing);
      return;
    }

    const startPos = animatedPos;
    const startBearing = animatedBearing;
    const dist = Math.hypot(targetPos[0] - startPos[0], targetPos[1] - startPos[1]);

    if (dist === 0) return;
    if (dist > 0.08) {
      setAnimatedPos(targetPos);
      setAnimatedBearing(targetBearing);
      return;
    }

    // Glide smoothly over time (fast during playback, slow & steady 2.6s during live GPS tracking)
    const duration = isPlaying ? Math.max(80, 260 / playbackSpeed) : 2600;
    const startTime = performance.now();

    const glide = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const curLat = startPos[0] + (targetPos[0] - startPos[0]) * progress;
      const curLng = startPos[1] + (targetPos[1] - startPos[1]) * progress;

      let dTheta = (targetBearing - startBearing) % 360;
      if (dTheta > 180) dTheta -= 360;
      if (dTheta < -180) dTheta += 360;
      const curBearing = (startBearing + dTheta * progress + 360) % 360;

      setAnimatedPos([curLat, curLng]);
      setAnimatedBearing(curBearing);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(glide);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(glide);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [activePt?.lat, activePt?.lng, activeBearing, isPlaying, playbackSpeed]);

  const fullPolyline = routePoints.map(pt => [pt.lat, pt.lng]);
  const progressPolyline = routePoints.slice(0, playbackIndex + 1).map(pt => [pt.lat, pt.lng]);

  const status = (p.attributes?.currentStatus || d.status || 'OFFLINE').toUpperCase();
  const markerColor = routePoints.length > 0 ? '#2563eb' : (status === 'RUNNING' ? '#059669' : (status === 'STOPPED' ? '#d97706' : '#ef4444'));
  const cardinalDirection = getCompassDirection(animatedBearing || activeBearing);

  return (
    <div className="modal-backdrop-fixed z-50">
      <div className={`modal-sheet-card flex flex-col bg-white overflow-hidden shadow-2xl transition-all duration-200 ${isFullscreen ? 'fixed inset-0 w-screen h-screen rounded-none max-w-none' : 'max-w-6xl h-[94vh] rounded-2xl'}`}>
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between bg-white flex-shrink-0 gap-3 z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold shadow">
              <Navigation size={20} className="text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">{d.name || 'Unnamed Vehicle'}</h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' : (status === 'STOPPED' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800')}`}>
                  {status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-2">
                <span>IMEI: {d.uniqueId || '--'} | Model: {d.model || 'G11'} | SIM: {d.phone || '--'}</span>
                {resolvedAddress && (
                  <span className="text-blue-700 font-sans font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1 max-w-sm truncate" title={resolvedAddress}>
                    <MapPin size={11} className="text-blue-600 shrink-0" />
                    <span className="truncate">{resolvedAddress}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Telemetry Pills */}
          <div className="hidden lg:flex items-center gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <div className="font-mono">
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Velocity</span>
              <strong className="text-slate-900 font-black text-sm">{activeSpeed} km/h</strong>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Distance</span>
              <strong className="text-blue-600 font-mono font-bold text-xs">{currentDistanceKm} / {totalDistanceKm} km</strong>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Ignition</span>
              <strong className={p.attributes?.ignition ? 'text-emerald-600 font-black' : 'text-slate-500 font-black'}>
                {p.attributes?.ignition ? 'ON' : 'OFF'}
              </strong>
            </div>
          </div>

          {/* History Query Bar */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <input
              type="datetime-local"
              value={fromTime}
              onChange={e => setFromTime(e.target.value)}
              className="text-[11px] form-input py-1 px-2 border-slate-200 bg-white font-medium rounded-lg"
            />
            <input
              type="datetime-local"
              value={toTime}
              onChange={e => setToTime(e.target.value)}
              className="text-[11px] form-input py-1 px-2 border-slate-200 bg-white font-medium rounded-lg"
            />
            <button
              onClick={fetchRoute}
              disabled={loadingRoute}
              className="btn-royal-blue px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              {loadingRoute ? 'Loading...' : <><Search size={13} /> Load Route</>}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isLiveStream && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-[11px] font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Live Running Active</span>
              </div>
            )}
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Map Container with Overlays */}
        <div className="flex-1 w-full relative bg-slate-100 min-h-0">
          
          {/* Floating Tile Layer Switcher */}
          <div className="absolute top-4 right-4 z-[500] bg-white/95 backdrop-blur-sm rounded-xl p-1 shadow-lg border border-slate-200 flex items-center gap-1 text-[11px] font-bold">
            {Object.keys(TILE_PROVIDERS).map(key => (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                className={`px-3 py-1.5 rounded-lg transition capitalize ${activeLayer === key ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                {TILE_PROVIDERS[key].name}
              </button>
            ))}
          </div>

          {/* Floating Telematics HUD Overlay */}
          <div className="absolute top-4 left-4 z-[500] bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-3.5 pointer-events-none">
            {/* Speedometer Gauge Pill */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${activeSpeed > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                <Gauge size={18} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Speed</span>
                <span className="text-base font-black font-mono leading-none">{activeSpeed} <span className="text-[10px] font-sans font-medium text-slate-400">km/h</span></span>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-700/80"></div>

            {/* Heading Compass Pill */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center transition-transform"
                style={{ transform: `rotate(${Math.round(activeBearing)}deg)` }}
              >
                <Compass size={18} />
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Heading</span>
                <span className="text-xs font-black font-mono leading-none">{Math.round(activeBearing)}° {cardinalDirection}</span>
              </div>
            </div>

            {routePoints.length > 0 && (
              <>
                <div className="w-px h-8 bg-slate-700/80"></div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Odometer Run</span>
                  <span className="text-xs font-black font-mono leading-none text-emerald-400">{currentDistanceKm} <span className="text-slate-400 font-normal">/ {totalDistanceKm} km</span></span>
                </div>
              </>
            )}

          </div>

          <MapContainer center={centerLatLng} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <ZoomControl position="bottomright" />
            
            {/* Reliable Base Underlay so map NEVER renders blank blue */}
            <TileLayer
              key="base-osm-underlay"
              attribution='&copy; OpenStreetMap contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              zIndex={1}
            />

            {/* Active Selected Layer (Carto / OSM / Satellite / Dark) on top */}
            {activeLayer !== 'osm' && (
              <TileLayer
                key={activeLayer}
                attribution={TILE_PROVIDERS[activeLayer].attribution}
                url={TILE_PROVIDERS[activeLayer].url}
                subdomains={TILE_PROVIDERS[activeLayer].subdomains || ['a', 'b', 'c', 'd']}
                maxZoom={TILE_PROVIDERS[activeLayer].maxZoom || 20}
                maxNativeZoom={19}
                zIndex={10}
              />
            )}
            {(activeLayer === 'satellite' || activeLayer === 'hybrid') && (
              <>
                <TileLayer
                  key="satellite-labels"
                  url={TILE_PROVIDERS.hybrid.labelsUrl}
                  maxZoom={19}
                  maxNativeZoom={19}
                  zIndex={400}
                />
                <TileLayer
                  key="satellite-roads"
                  url={TILE_PROVIDERS.hybrid.roadsUrl}
                  maxZoom={19}
                  maxNativeZoom={19}
                  zIndex={401}
                />
              </>
            )}

            {/* Static Complete Path */}
            {fullPolyline.length > 0 && (
              <Polyline positions={fullPolyline} color="#3b82f6" weight={4} opacity={0.8} />
            )}

            {/* Traveled History Progress Path */}
            {progressPolyline.length > 0 && (
              <Polyline positions={progressPolyline} color="#10b981" weight={5} opacity={0.95} />
            )}

            {/* Start Waypoint */}
            {routePoints.length > 0 && (
              <Marker
                position={[routePoints[0].lat, routePoints[0].lng]}
                icon={createWaypointIcon('start', 'START')}
              >
                <Popup>
                  <div className="text-xs font-bold text-emerald-700">Journey Start Point</div>
                  <div className="text-[10px] text-slate-500 font-mono">{routePoints[0].time}</div>
                </Popup>
              </Marker>
            )}

            {/* Finish Waypoint */}
            {routePoints.length > 1 && (
              <Marker
                position={[routePoints[routePoints.length - 1].lat, routePoints[routePoints.length - 1].lng]}
                icon={createWaypointIcon('end', 'FINISH')}
              >
                <Popup>
                  <div className="text-xs font-bold text-red-700">Journey End Point</div>
                  <div className="text-[10px] text-slate-500 font-mono">{routePoints[routePoints.length - 1].time}</div>
                </Popup>
              </Marker>
            )}

            {/* Active Moving Vehicle Marker with Category Silhouette */}
            {activePt && (
              <Marker
                position={animatedPos || [activePt.lat, activePt.lng]}
                icon={createDirectionalVehicleIcon(animatedBearing || activeBearing, markerColor, d.name, d.category)}
              >
                {resolvedAddress && (
                  <Tooltip permanent direction="top" offset={[0, -22]} className="vehicle-location-tooltip">
                    <div className="px-2.5 py-0.5 bg-emerald-600 text-white font-bold text-[11px] rounded-full shadow-lg border border-white/50 flex items-center gap-1 whitespace-nowrap pointer-events-none">
                      <span className="text-[10px]">📍</span>
                      <span className="truncate max-w-[170px]">{resolvedAddress.split(',')[0]}</span>
                    </div>
                  </Tooltip>
                )}
                <Popup>
                  <div className="text-xs font-bold text-slate-900">{d.name}</div>
                  <div className="text-[10px] text-slate-600 capitalize font-medium">{d.category || 'Car'} • {d.model || 'Tracker'}</div>
                  {resolvedAddress && (
                    <div className="text-[11px] text-blue-700 font-medium bg-blue-50 p-2 rounded-lg border border-blue-200 mt-1.5 flex items-start gap-1.5 leading-snug">
                      <MapPin size={13} className="shrink-0 text-blue-600 mt-0.5" />
                      <span>{resolvedAddress}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-blue-600 font-mono font-bold mt-1.5">Speed: {activeSpeed} km/h</div>
                  <div className="text-[10px] text-slate-500 font-mono">Bearing: {Math.round(animatedBearing || activeBearing)}° ({cardinalDirection})</div>
                  <div className="text-[10px] text-slate-500 font-mono">Fix Time: {activeTime}</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-1">Coords: {activePt.lat.toFixed(5)}, {activePt.lng.toFixed(5)}</div>
                </Popup>
              </Marker>
            )}

            <MapController
              center={animatedPos || (activePt ? [activePt.lat, activePt.lng] : centerLatLng)}
              bounds={fullPolyline.length > 0 && playbackIndex === 0 ? fullPolyline : null}
              isPlaying={isPlaying || isLiveStream}
              isFullscreen={isFullscreen}
            />
          </MapContainer>
        </div>

        {/* Playback Control Bar */}
        {routePoints.length > 0 && (
          <div className="p-3.5 bg-white flex flex-wrap sm:flex-nowrap items-center gap-3.5 border-t border-slate-200 shadow-lg relative z-20">
            
            {/* Fix Time Pill */}
            <div className="flex flex-col min-w-[130px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock size={11} /> Telematics Fix
              </span>
              <span className="text-xs font-mono font-bold text-blue-600">{activeTime}</span>
            </div>

            {/* Step & Play/Pause Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={resetPlayback}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                title="Reset to Start"
              >
                <RotateCcw size={14} />
              </button>

              <button
                onClick={stepBackward}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                title="Step Backward (Left Arrow)"
              >
                <SkipBack size={14} />
              </button>

              <button
                onClick={togglePlayback}
                className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-black transition flex-shrink-0 shadow-md"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>

              <button
                onClick={stepForward}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                title="Step Forward (Right Arrow)"
              >
                <SkipForward size={14} />
              </button>
            </div>

            {/* Timeline Scrubber */}
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min="0"
                max={routePoints.length - 1}
                value={playbackIndex}
                onChange={e => onSeek(e.target.value)}
                className="flex-1 accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono font-bold text-slate-500 min-w-[70px] text-right">
                {Math.round(((playbackIndex + 1) / routePoints.length) * 100)}%
              </span>
            </div>

            {/* Points Counter */}
            <span className="text-xs font-mono font-bold text-slate-700 min-w-[75px] text-right">
              {playbackIndex + 1} / {routePoints.length}
            </span>

            {/* Speed Multiplier */}
            <select
              value={playbackSpeed}
              onChange={e => setPlaybackSpeed(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white font-bold text-slate-700 flex-shrink-0 shadow-sm"
            >
              <option value="1">1x Speed</option>
              <option value="2">2x Speed</option>
              <option value="5">5x Speed</option>
              <option value="10">10x Speed</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

