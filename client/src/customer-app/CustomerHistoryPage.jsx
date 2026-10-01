import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import L from 'leaflet';
import { useCustomerTracking } from './CustomerTrackingContext';
import { createMap, setMapLayer, smoothGlideMarker, isValidCoord, MAP_PROVIDERS } from './map';
import { createDirectionalVehicleIcon, createWaypointIcon } from '../components/VehicleIcons';
import axios from 'axios';
import VehicleLoadingAnimation from './VehicleLoadingAnimation';
import { Play, Pause, RotateCcw, Calendar, Gauge, Navigation, Loader2, Layers } from 'lucide-react';

export default function CustomerHistoryPage() {
  const { liveVehicles, selectedVehicle, setSelectedVehicleId } = useCustomerTracking();
  const location = useLocation();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const polylineRef = useRef(null);
  const replayMarkerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const endMarkerRef = useRef(null);

  const stateFrom = location.state?.from;
  const stateTo = location.state?.to;
  const stateVehicleId = location.state?.vehicleId;

  const [datePreset, setDatePreset] = useState(stateFrom ? 'custom' : 'yesterday');
  const [activeTile, setActiveTile] = useState('voyager');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const intervalRef = useRef(null);

  const activeVehicle = (stateVehicleId ? liveVehicles.find(v => v.id === stateVehicleId) : null) || selectedVehicle || liveVehicles[0];

  // Initialize map with OSM (100% reliable)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = activeVehicle?.latitude || 25.6528;
    const defaultLng = activeVehicle?.longitude || 84.969;

    const { map, layerGroup } = createMap(mapContainerRef.current, [defaultLat, defaultLng], 14, 'voyager');
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (polylineRef.current) { try { map.removeLayer(polylineRef.current); } catch (e) {} polylineRef.current = null; }
      if (replayMarkerRef.current) { try { map.removeLayer(replayMarkerRef.current); } catch (e) {} replayMarkerRef.current = null; }
      if (startMarkerRef.current) { try { map.removeLayer(startMarkerRef.current); } catch (e) {} startMarkerRef.current = null; }
      if (endMarkerRef.current) { try { map.removeLayer(endMarkerRef.current); } catch (e) {} endMarkerRef.current = null; }
      try { map.remove(); } catch (e) {}
      mapInstanceRef.current = null;
    };
  }, []);

  const handleSwitchLayer = (key) => {
    setActiveTile(key);
    setShowLayerMenu(false);
    if (mapInstanceRef.current && layerGroupRef.current) {
      setMapLayer(mapInstanceRef.current, layerGroupRef.current, key);
    }
  };

  // AUTO-LOAD on vehicle or date change!
  useEffect(() => {
    if (!activeVehicle?.id) return;

    // Immediately CLEAR old vehicle cached route points and map markers!
    setRoutePoints([]);
    setPlaybackIndex(0);
    setIsPlaying(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null; }
      if (replayMarkerRef.current) { map.removeLayer(replayMarkerRef.current); replayMarkerRef.current = null; }
      if (startMarkerRef.current) { map.removeLayer(startMarkerRef.current); startMarkerRef.current = null; }
      if (endMarkerRef.current) { map.removeLayer(endMarkerRef.current); endMarkerRef.current = null; }

      // Center to new vehicle's location
      if (isValidCoord(activeVehicle.latitude, activeVehicle.longitude)) {
        map.setView([activeVehicle.latitude, activeVehicle.longitude], 14);
      }
    }

    let isSubscribed = true;
    setLoading(true);
    setHasSearched(true);

    let from = new Date();
    let to = new Date();

    if (stateFrom && stateTo && datePreset === 'custom') {
      from = new Date(stateFrom);
      to = new Date(stateTo);
    } else if (datePreset === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (datePreset === 'yesterday') {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
    } else if (datePreset === 'week') {
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
    }

    axios.get('/api/reports/route', {
      params: {
        deviceId: activeVehicle.id,
        from: from.toISOString(),
        to: to.toISOString()
      }
    })
    .then(res => {
      if (!isSubscribed) return;
      const points = Array.isArray(res.data) ? res.data : [];
      setRoutePoints(points);

      if (mapInstanceRef.current && points.length > 0) {
        const map = mapInstanceRef.current;
        const latlngs = points.map(p => [p.latitude, p.longitude]);

        // PREVENT DUPLICATES: Explicitly remove any existing markers and polylines before adding
        if (polylineRef.current) { try { map.removeLayer(polylineRef.current); } catch (e) {} polylineRef.current = null; }
        if (replayMarkerRef.current) { try { map.removeLayer(replayMarkerRef.current); } catch (e) {} replayMarkerRef.current = null; }
        if (startMarkerRef.current) { try { map.removeLayer(startMarkerRef.current); } catch (e) {} startMarkerRef.current = null; }
        if (endMarkerRef.current) { try { map.removeLayer(endMarkerRef.current); } catch (e) {} endMarkerRef.current = null; }

        polylineRef.current = L.polyline(latlngs, {
          color: '#2563eb',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(map);

        map.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });

        // START & FINISH Waypoints
        startMarkerRef.current = L.marker(latlngs[0], { icon: createWaypointIcon('start', 'START') }).addTo(map);
        endMarkerRef.current = L.marker(latlngs[latlngs.length - 1], { icon: createWaypointIcon('finish', 'FINISH') }).addTo(map);

        // Exactly ONE single replay vehicle marker
        const firstPoint = points[0];
        const replayIcon = createDirectionalVehicleIcon(
          firstPoint.course || 0,
          '#2563eb',
          activeVehicle.name,
          activeVehicle.category || 'car'
        );

        replayMarkerRef.current = L.marker(latlngs[0], { icon: replayIcon }).addTo(map);
      }
    })
    .catch(() => {
      if (isSubscribed) setRoutePoints([]);
    })
    .finally(() => {
      if (isSubscribed) setLoading(false);
    });

    return () => {
      isSubscribed = false;
    };
  }, [activeVehicle?.id, datePreset]);

  // Smooth 60fps animation loop during playback: lag-free and continuous
  useEffect(() => {
    if (!isPlaying || routePoints.length === 0) return;

    const stepInterval = Math.max(50, 480 / playSpeed);
    intervalRef.current = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= routePoints.length - 1) {
          clearInterval(intervalRef.current);
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        const pt = routePoints[next];
        if (replayMarkerRef.current && pt) {
          const icon = createDirectionalVehicleIcon(
            pt.course || 0,
            '#2563eb',
            activeVehicle.name,
            activeVehicle.category || 'car'
          );
          replayMarkerRef.current.setIcon(icon);
          // Glides smoothly to next point over exact step duration without lag
          smoothGlideMarker(replayMarkerRef.current, pt.latitude, pt.longitude, pt.course, stepInterval);
          
          // Boundary-based pan: Only pans when vehicle gets near the edge of visible map
          if (mapInstanceRef.current) {
            const map = mapInstanceRef.current;
            try {
              const bounds = map.getBounds();
              if (!bounds.pad(-0.2).contains([pt.latitude, pt.longitude])) {
                map.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.9 });
              }
            } catch (e) {}
          }
        }
        return next;
      });
    }, stepInterval);

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, routePoints, playSpeed, activeVehicle]);

  const handleSliderChange = (e) => {
    const idx = parseInt(e.target.value);
    setPlaybackIndex(idx);
    const pt = routePoints[idx];
    if (replayMarkerRef.current && pt) {
      const icon = createDirectionalVehicleIcon(
        pt.course || 0,
        '#2563eb',
        activeVehicle.name,
        activeVehicle.category || 'car'
      );
      replayMarkerRef.current.setIcon(icon);
      replayMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
      mapInstanceRef.current?.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.3 });
    }
  };

  const currentPoint = routePoints[playbackIndex] || {};
  const currentSpeed = Math.round(currentPoint.speed ? currentPoint.speed * 1.852 : 0);
  const totalKm = useMemo(() => {
    return (routePoints.reduce((acc, p) => acc + (p.attributes?.distance || 0), 0) / 1000).toFixed(1);
  }, [routePoints]);
  const maxSpeed = useMemo(() => {
    if (routePoints.length === 0) return 0;
    return Math.round(Math.max(...routePoints.map(p => (p.speed || 0) * 1.852), 0));
  }, [routePoints]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-50 select-none flex flex-col">
      
      {/* Top Selector Bar (Auto-loads immediately on select) */}
      <div className="p-3 bg-white border-b border-slate-200 space-y-2 z-20 shrink-0 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* ONLY Vehicle Registration Number */}
          <select
            value={activeVehicle?.id || ''}
            onChange={(e) => setSelectedVehicleId(parseInt(e.target.value))}
            className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
          >
            {liveVehicles.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          {/* Date presets with instant auto-load */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {['today', 'yesterday', 'week'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold capitalize transition cursor-pointer ${
                  datePreset === preset ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'week' ? '7 Days' : preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative min-h-0">
        <div ref={mapContainerRef} className="w-full h-full z-0" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

        {/* Floating Layer Switcher */}
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="w-10 h-10 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 transition cursor-pointer"
            title="Switch Map"
          >
            <Layers size={18} />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xl space-y-1 w-64 z-30 animate-fadeIn">
              {Object.entries(MAP_PROVIDERS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => handleSwitchLayer(key)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTile === key ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {val.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
            <VehicleLoadingAnimation vehicleNumber={activeVehicle?.name || 'AbsTracker'} message="Auto-loading route playback..." />
          </div>
        )}

        {!loading && hasSearched && routePoints.length === 0 && (
          <div className="absolute top-4 left-4 right-4 bg-white/95 border border-slate-200 p-3 rounded-2xl shadow-lg z-20 text-center text-xs font-semibold text-slate-600">
            No route history recorded for this date. Tap <span className="font-bold text-blue-600">Yesterday</span> or <span className="font-bold text-blue-600">7 Days</span>.
          </div>
        )}
      </div>

      {/* Bottom Playback Control Sheet */}
      <div className="p-3 bg-white border-t border-slate-200 space-y-2 z-20 shrink-0 shadow-lg">
        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block">Distance</span>
            <span className="font-black text-blue-600 text-xs">{totalKm} km</span>
          </div>
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block">Top Speed</span>
            <span className="font-black text-red-600 text-xs">{maxSpeed} km/h</span>
          </div>
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block">Live Speed</span>
            <span className="font-black text-emerald-600 text-xs">{currentSpeed} km/h</span>
          </div>
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block">Points</span>
            <span className="font-black text-slate-700 text-xs">{routePoints.length}</span>
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, routePoints.length - 1)}
            value={playbackIndex}
            onChange={handleSliderChange}
            disabled={routePoints.length === 0}
            className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>{routePoints[0]?.fixTime ? new Date(routePoints[0].fixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}</span>
            <span>{currentPoint.fixTime ? new Date(currentPoint.fixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Current'}</span>
            <span>{routePoints[routePoints.length - 1]?.fixTime ? new Date(routePoints[routePoints.length - 1].fixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'End'}</span>
          </div>
        </div>

        {/* Playback Button Controls */}
        <div className="flex items-center justify-between gap-2 pt-1 pb-1">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            {[1, 2, 5].map(spd => (
              <button
                key={spd}
                onClick={() => setPlaySpeed(spd)}
                className={`px-2 py-1 rounded-xl text-[10px] font-black transition cursor-pointer ${
                  playSpeed === spd ? 'bg-blue-600 text-white' : 'text-slate-600'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPlaybackIndex(0);
                setIsPlaying(false);
                if (routePoints[0] && replayMarkerRef.current) {
                  replayMarkerRef.current.setLatLng([routePoints[0].latitude, routePoints[0].longitude]);
                }
              }}
              disabled={routePoints.length === 0}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-700 disabled:opacity-40 cursor-pointer"
              title="Reset"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={routePoints.length === 0}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 disabled:opacity-40 cursor-pointer"
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
