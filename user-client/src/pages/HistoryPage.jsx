import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useLocation } from 'react-router-dom';
import { useTracking } from '../contexts/TrackingContext';
import { api } from '../api/client';
import VehicleLoadingAnimation from '../components/VehicleLoadingAnimation';
import { Play, Pause, RotateCcw, Calendar, Gauge, Navigation, Loader2, Search, CheckCircle2 } from 'lucide-react';

export default function HistoryPage() {
  const { liveVehicles, selectedVehicle, setSelectedVehicleId } = useTracking();
  const location = useLocation();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const replayMarkerRef = useRef(null);

  const [datePreset, setDatePreset] = useState('yesterday');
  const [routePoints, setRoutePoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(2);

  const activeVehicle = selectedVehicle || liveVehicles[0];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [activeVehicle?.latitude || 25.6528, activeVehicle?.longitude || 84.969],
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });
    mapRef.current = map;

    // CartoDB Voyager HD - Full Detailed Roads, Villages, Landmarks & Small Places
    const cartoKey = 'cb1_46td_1_0e579b70c224a3f9a3117650';
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=${cartoKey}`, {
      maxZoom: 20,
      maxNativeZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors'
    }).addTo(map);

    // Guaranteed tile rendering: invalidateSize at 100ms, 300ms, and 800ms
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    const t3 = setTimeout(() => map.invalidateSize(), 800);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    const handleWinResize = () => map.invalidateSize();
    window.addEventListener('resize', handleWinResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleWinResize);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleShowPlayback = async () => {
    if (!activeVehicle?.id) return;
    setLoading(true);
    setHasSearched(true);
    setIsPlaying(false);
    setPlaybackIndex(0);

    let from = new Date();
    let to = new Date();

    if (datePreset === 'today') {
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

    try {
      const res = await api.get('/api/reports/route', {
        params: {
          deviceId: activeVehicle.id,
          from: from.toISOString(),
          to: to.toISOString()
        }
      });

      const points = Array.isArray(res.data) ? res.data : [];
      setRoutePoints(points);

      if (mapRef.current) {
        const map = mapRef.current;
        if (polylineRef.current) map.removeLayer(polylineRef.current);
        if (replayMarkerRef.current) map.removeLayer(replayMarkerRef.current);

        if (points.length > 0) {
          const latlngs = points.map(p => [p.latitude, p.longitude]);

          polylineRef.current = L.polyline(latlngs, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(map);

          map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });

          L.circleMarker(latlngs[0], { radius: 7, fillColor: '#16a34a', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
          L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, fillColor: '#dc2626', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);

          const replayIcon = L.divIcon({
            className: 'replay-marker',
            html: `<div style="width: 32px; height: 32px; border-radius: 9999px; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(37,99,235,0.4); display: flex; align-items: center; justify-content: center;">
              <div style="width: 10px; height: 10px; border-radius: 9999px; background: #ffffff;"></div>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          replayMarkerRef.current = L.marker(latlngs[0], { icon: replayIcon }).addTo(map);
        }
      }
    } catch (err) {
      console.error('Route fetch error:', err.message);
      setRoutePoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleShowPlayback();
  }, [activeVehicle?.id, datePreset]);

  useEffect(() => {
    if (!isPlaying || routePoints.length === 0) return;

    const interval = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= routePoints.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = prev + 1;
        const pt = routePoints[next];
        if (replayMarkerRef.current && pt) {
          replayMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
        }
        return next;
      });
    }, Math.max(20, 200 / playSpeed));

    return () => clearInterval(interval);
  }, [isPlaying, routePoints, playSpeed]);

  const handleSliderChange = (e) => {
    const idx = parseInt(e.target.value);
    setPlaybackIndex(idx);
    const pt = routePoints[idx];
    if (replayMarkerRef.current && pt) {
      replayMarkerRef.current.setLatLng([pt.latitude, pt.longitude]);
      mapRef.current?.panTo([pt.latitude, pt.longitude], { animate: true, duration: 0.3 });
    }
  };

  const currentPoint = routePoints[playbackIndex] || {};
  const currentSpeed = Math.round(currentPoint.speed ? currentPoint.speed * 1.852 : 0);
  const totalKm = (routePoints.reduce((acc, p) => acc + (p.attributes?.distance || 0), 0) / 1000).toFixed(1);
  const maxSpeed = Math.round(Math.max(...routePoints.map(p => (p.speed || 0) * 1.852), 0));

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100 select-none flex flex-col font-sans">
      
      {/* Top Filter and Controls Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200/90 space-y-2.5 z-20 shrink-0 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <select
            value={activeVehicle?.id || ''}
            onChange={(e) => setSelectedVehicleId(parseInt(e.target.value))}
            className="flex-1 bg-slate-100/90 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer font-sans"
          >
            {liveVehicles.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.category.toUpperCase()})</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 self-end sm:self-auto">
            {['today', 'yesterday', 'week'].map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${
                  datePreset === preset ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'week' ? '7 Days' : preset}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleShowPlayback}
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer transition"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          <span>{loading ? 'Loading Route Telemetry...' : 'Refresh Route Playback'}</span>
        </button>
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {loading && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-xs flex items-center justify-center z-20">
            <VehicleLoadingAnimation vehicleNumber={activeVehicle?.name || 'AbsTracker'} message="Loading route replay data..." />
          </div>
        )}

        {!loading && hasSearched && routePoints.length === 0 && (
          <div className="absolute top-4 left-4 right-4 md:max-w-md md:left-1/2 md:-translate-x-1/2 bg-white/95 border border-slate-200 p-3.5 rounded-2xl shadow-xl z-20 text-center text-xs font-semibold text-slate-600 backdrop-blur-md">
            No driving history recorded for this period. Try selecting <span className="font-bold text-blue-600">Yesterday</span>.
          </div>
        )}
      </div>

      {/* Bottom Playback Control Sheet */}
      <div className="p-3 sm:p-4 bg-white/98 backdrop-blur-xl border-t border-slate-200/90 space-y-3 z-20 shrink-0 shadow-xl max-w-4xl mx-auto w-full md:rounded-t-3xl">
        <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
          <div className="bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block uppercase">Distance</span>
            <span className="font-black text-blue-600 text-xs sm:text-sm font-mono tabular-nums">{totalKm} km</span>
          </div>
          <div className="bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block uppercase">Top Speed</span>
            <span className="font-black text-red-600 text-xs sm:text-sm font-mono tabular-nums">{maxSpeed} km/h</span>
          </div>
          <div className="bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block uppercase">Live Speed</span>
            <span className="font-black text-emerald-600 text-xs sm:text-sm font-mono tabular-nums">{currentSpeed} km/h</span>
          </div>
          <div className="bg-slate-50 p-2 sm:p-2.5 rounded-2xl border border-slate-100">
            <span className="text-slate-400 font-semibold block uppercase">Track Points</span>
            <span className="font-black text-slate-700 text-xs sm:text-sm font-mono tabular-nums">{routePoints.length}</span>
          </div>
        </div>

        {/* Timeline Range Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, routePoints.length - 1)}
            value={playbackIndex}
            onChange={handleSliderChange}
            disabled={routePoints.length === 0}
            className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>{currentPoint.fixTime ? new Date(currentPoint.fixTime).toLocaleTimeString('en-IN') : '--:--'}</span>
            <span>{routePoints.length > 0 ? `${playbackIndex + 1} / ${routePoints.length}` : 'No Route Loaded'}</span>
          </div>
        </div>

        {/* Playback Action Controls */}
        <div className="flex items-center justify-between gap-2.5 pt-0.5">
          <button
            onClick={() => {
              setPlaybackIndex(0);
              if (replayMarkerRef.current && routePoints[0]) {
                replayMarkerRef.current.setLatLng([routePoints[0].latitude, routePoints[0].longitude]);
              }
            }}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition"
            title="Reset to beginning"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={routePoints.length === 0}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 cursor-pointer transition"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause Replay' : 'Start Route Playback'}</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {[1, 2, 5, 10].map(s => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition ${
                  playSpeed === s ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
