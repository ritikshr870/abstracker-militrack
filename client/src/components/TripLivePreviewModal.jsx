import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, MapPin, Gauge, Clock, Route, Compass, Check, Copy, 
  Play, Pause, RotateCcw, FastForward, Navigation 
} from 'lucide-react';
import { createDirectionalVehicleIcon, calculateBearing } from './VehicleIcons';

const TILE_PROVIDERS = {
  maptilerStreets: {
    name: 'MapTiler Streets HD',
    url: 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=UFzZhhOMgEjhPErFufnk',
    maxZoom: 20,
    attribution: '&copy; MapTiler &copy; OpenStreetMap contributors'
  },
  maptilerSatellite: {
    name: 'MapTiler Satellite HD',
    url: 'https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=UFzZhhOMgEjhPErFufnk',
    maxZoom: 20,
    attribution: '&copy; MapTiler'
  },
  traveltime: {
    name: 'TravelTime HD',
    url: 'https://tiles.traveltimeapp.com/osm-bright/{z}/{x}/{y}.png?key=4b4350ea',
    maxZoom: 19,
    attribution: '&copy; TravelTime &copy; OpenStreetMap'
  },
  esriStreets: {
    name: 'Google Streets HD',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 20,
    attribution: '&copy; Esri &mdash; Street Map HD'
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  },
  hybrid: {
    name: 'Satellite HD',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    roadsUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; High-Res Satellite'
  }
};

function MapController({ points, currentPosition, isPlaying }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  // Fit bounds strictly ONCE when trip points are loaded
  useEffect(() => {
    if (!fittedRef.current && points && points.length > 1) {
      const validPoints = points.filter(
        (p) => p && !isNaN(p[0]) && !isNaN(p[1]) && p[0] !== 0 && p[1] !== 0 && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
      );
      if (validPoints.length > 1) {
        try {
          map.fitBounds(L.latLngBounds(validPoints), { padding: [60, 60], maxZoom: 16 });
          fittedRef.current = true;
        } catch (e) {}
      } else if (validPoints.length === 1) {
        map.setView(validPoints[0], 15);
        fittedRef.current = true;
      }
    }
  }, [points, map]);

  // Smoothly pan to vehicle position during playback
  useEffect(() => {
    if (isPlaying && currentPosition && !isNaN(currentPosition[0]) && !isNaN(currentPosition[1]) && currentPosition[0] !== 0) {
      map.panTo(currentPosition, { animate: true, duration: 0.15 });
    }
  }, [currentPosition, isPlaying, map]);

  return null;
}

const createPinIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-preview-pin',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center;">
        <div style="background:${color}; color:white; font-size:10px; font-weight:800; padding:2px 8px; border-radius:12px; border:2px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.3); white-space:nowrap;">
          ${label}
        </div>
        <div style="width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid ${color};"></div>
      </div>
    `,
    iconSize: [60, 30],
    iconAnchor: [30, 28]
  });
};

function densifyRoutePoints(points, subSteps = 3) {
  if (!points || points.length < 2) return points || [];
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    for (let s = 0; s < subSteps; s++) {
      const t = s / subSteps;
      result.push({
        lat: curr.lat + (next.lat - curr.lat) * t,
        lon: curr.lon + (next.lon - curr.lon) * t,
        speed: curr.speed || next.speed || '0 km/h',
        time: curr.time || next.time || '',
        course: curr.course || next.course || 0
      });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function interpolatePoints(start, end, count = 120) {
  const sLat = Number(start?.lat) || 25.5941;
  const sLon = Number(start?.lon) || 85.1376;
  const eLat = Number(end?.lat) || (sLat + 0.015);
  const eLon = Number(end?.lon) || (sLon + 0.015);

  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    pts.push({
      lat: sLat + (eLat - sLat) * t,
      lon: sLon + (eLon - sLon) * t,
      speed: `${Math.round(28 + Math.sin(t * Math.PI) * 26)} km/h`,
      time: `Leg ${(t * 100).toFixed(0)}%`
    });
  }
  return pts;
}

export default function TripLivePreviewModal({ data, onClose }) {
  const [activeLayer, setActiveLayer] = useState('maptilerStreets');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x, 10x

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!data) return null;

  const { title, vehicle, type, startPoint, endPoint, stats, polyline, routePoints } = data;

  // Build effective playback points with coordinate validation and micro-densification
  const effectivePoints = useMemo(() => {
    if (routePoints && routePoints.length > 1) {
      const filtered = routePoints.filter(p => p && !isNaN(p.lat) && !isNaN(p.lon) && p.lat !== 0 && p.lon !== 0);
      if (filtered.length > 1) return densifyRoutePoints(filtered, 3);
    }
    if (startPoint && endPoint && !isNaN(startPoint.lat) && !isNaN(endPoint.lat) && startPoint.lat !== 0 && endPoint.lat !== 0) {
      return interpolatePoints(startPoint, endPoint, 120);
    }
    if (polyline && polyline.length > 0) {
      const valid = polyline.filter(p => p && !isNaN(p[0]) && !isNaN(p[1]) && p[0] !== 0 && p[1] !== 0);
      if (valid.length > 0) {
        const pts = valid.map((p, idx) => ({
          lat: p[0],
          lon: p[1],
          speed: stats?.speed || '35 km/h',
          time: `Fix #${idx + 1}`
        }));
        return densifyRoutePoints(pts, 3);
      }
    }
    return [{ lat: 25.5941, lon: 85.1376, speed: '0 km/h', time: 'Start' }];
  }, [routePoints, startPoint, endPoint, polyline, stats]);

  // Safe initial center
  const safeCenter = useMemo(() => {
    for (const p of effectivePoints) {
      if (p && !isNaN(p.lat) && !isNaN(p.lon) && p.lat !== 0 && p.lon !== 0) {
        return [p.lat, p.lon];
      }
    }
    return [25.5941, 85.1376];
  }, [effectivePoints]);

  // Reset index when data changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [data]);

  // Playback timer loop: smooth 55ms micro-stepping for professional slow fluid motion
  useEffect(() => {
    if (!isPlaying) return;

    const baseDelay = 55; // ms per micro-step
    const stepDelay = Math.max(15, Math.floor(baseDelay / playbackSpeed));

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= effectivePoints.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, stepDelay);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, effectivePoints.length]);

  const currentPoint = effectivePoints[currentIndex] || effectivePoints[0];
  const prevPoint = effectivePoints[Math.max(0, currentIndex - 1)] || currentPoint;
  const nextPoint = effectivePoints[currentIndex + 1] || currentPoint;

  const currentBearing = useMemo(() => {
    if (currentPoint.course && Number(currentPoint.course) > 0) {
      return Number(currentPoint.course);
    }
    if (nextPoint && (nextPoint.lat !== currentPoint.lat || nextPoint.lon !== currentPoint.lon)) {
      return calculateBearing(currentPoint.lat, currentPoint.lon, nextPoint.lat, nextPoint.lon);
    }
    if (prevPoint && (currentPoint.lat !== prevPoint.lat || currentPoint.lon !== prevPoint.lon)) {
      return calculateBearing(prevPoint.lat, prevPoint.lon, currentPoint.lat, currentPoint.lon);
    }
    return 0;
  }, [currentPoint, nextPoint, prevPoint]);

  const fullPolyline = useMemo(() => {
    return effectivePoints.map(p => [p.lat, p.lon]);
  }, [effectivePoints]);

  const completedPolyline = useMemo(() => {
    return fullPolyline.slice(0, currentIndex + 1);
  }, [fullPolyline, currentIndex]);

  const remainingPolyline = useMemo(() => {
    return fullPolyline.slice(currentIndex);
  }, [fullPolyline, currentIndex]);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleReplay = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center font-bold shadow-md">
              <Route size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight">{title || 'Trip Route Live Playback'}</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-[10px] font-bold uppercase font-mono">
                  Trip Playback
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Vehicle: <strong className="text-white">{vehicle || 'Fleet Asset'}</strong></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tile Layer Switcher */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl gap-1 text-[11px] font-bold">
              {Object.keys(TILE_PROVIDERS).map(key => (
                <button
                  key={key}
                  onClick={() => setActiveLayer(key)}
                  className={`px-2.5 py-1 rounded-lg transition ${activeLayer === key ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  {TILE_PROVIDERS[key].name}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Close Preview (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Map View Area */}
        <div className="flex-1 relative overflow-hidden">
          
          {/* Quick HUD Strip */}
          <div className="absolute top-3 left-3 z-[500] bg-slate-900/90 backdrop-blur-md text-white rounded-2xl px-4 py-2.5 shadow-xl border border-slate-700/80 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-red-500" />
              <div>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Speed</span>
                <strong className="font-mono font-black text-sm text-white">
                  {currentPoint.speed || stats?.speed || '0 km/h'}
                </strong>
              </div>
            </div>

            {stats?.distance && (
              <div className="flex items-center gap-2 border-l border-slate-700/80 pl-3">
                <Route size={16} className="text-blue-400" />
                <div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Distance</span>
                  <strong className="font-mono font-bold text-xs text-white">{stats.distance}</strong>
                </div>
              </div>
            )}

            {stats?.duration && (
              <div className="flex items-center gap-2 border-l border-slate-700/80 pl-3">
                <Clock size={16} className="text-emerald-400" />
                <div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Duration</span>
                  <strong className="font-mono font-bold text-xs text-white">{stats.duration}</strong>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 border-l border-slate-700/80 pl-3">
              <Compass size={16} className="text-amber-400" />
              <div>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Heading</span>
                <strong className="font-mono font-bold text-xs text-white">{Math.round(currentBearing)}°</strong>
              </div>
            </div>
          </div>

          {/* Leaflet Map */}
          <MapContainer
            center={safeCenter}
            zoom={14}
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
          >
            <ZoomControl position="bottomright" />

            {/* Reliable Base Underlay so map NEVER renders blank blue */}
            <TileLayer
              key="preview-base-osm"
              attribution='&copy; OpenStreetMap contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              zIndex={1}
            />

            {/* Active Selected Layer on top */}
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
                  key="preview-sat-labels"
                  url={TILE_PROVIDERS.hybrid.labelsUrl}
                  maxZoom={19}
                  maxNativeZoom={19}
                  zIndex={400}
                />
                <TileLayer
                  key="preview-sat-roads"
                  url={TILE_PROVIDERS.hybrid.roadsUrl}
                  maxZoom={19}
                  maxNativeZoom={19}
                  zIndex={401}
                />
              </>
            )}

            <MapController
              points={fullPolyline}
              currentPosition={[currentPoint.lat, currentPoint.lon]}
              isPlaying={isPlaying}
            />

            {/* Remaining Polyline (Dashed Light Blue) */}
            {remainingPolyline.length > 1 && (
              <Polyline positions={remainingPolyline} color="#60a5fa" weight={4} opacity={0.6} dashArray="6, 8" />
            )}

            {/* Completed Polyline (Solid Vibrant Blue) */}
            {completedPolyline.length > 1 && (
              <Polyline positions={completedPolyline} color="#2563eb" weight={5} opacity={0.9} />
            )}

            {/* Start Pin */}
            {startPoint && !isNaN(startPoint.lat) && !isNaN(startPoint.lon) && (
              <Marker
                position={[startPoint.lat, startPoint.lon]}
                icon={createPinIcon('#10b981', 'START')}
              >
                <Popup>
                  <div className="text-xs font-bold text-emerald-700">Trip Start Location</div>
                  {startPoint.time && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{startPoint.time}</div>}
                  {startPoint.address && <div className="text-[11px] text-slate-700 mt-1 max-w-xs">{startPoint.address}</div>}
                </Popup>
              </Marker>
            )}

            {/* Finish Pin */}
            {endPoint && !isNaN(endPoint.lat) && !isNaN(endPoint.lon) && (
              <Marker
                position={[endPoint.lat, endPoint.lon]}
                icon={createPinIcon('#ef4444', 'FINISH')}
              >
                <Popup>
                  <div className="text-xs font-bold text-red-700">Trip Destination Location</div>
                  {endPoint.time && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{endPoint.time}</div>}
                  {endPoint.address && <div className="text-[11px] text-slate-700 mt-1 max-w-xs">{endPoint.address}</div>}
                </Popup>
              </Marker>
            )}

            {/* Active Moving Vehicle Marker */}
            <Marker
              position={[currentPoint.lat, currentPoint.lon]}
              icon={createDirectionalVehicleIcon(currentBearing, '#2563eb', vehicle, 'car')}
              zIndexOffset={1000}
            >
              <Popup>
                <div className="text-xs font-bold text-slate-900">{vehicle || 'Vehicle'}</div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">Speed: {currentPoint.speed || '0 km/h'}</div>
                <div className="text-[10px] text-slate-400 font-mono">Heading: {Math.round(currentBearing)}°</div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        {/* Playback Controls & Timeline Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white border-t border-slate-800 space-y-2.5">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={() => {
                if (currentIndex >= effectivePoints.length - 1) {
                  setCurrentIndex(0);
                }
                setIsPlaying(!isPlaying);
              }}
              className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition flex-shrink-0 cursor-pointer"
              title={isPlaying ? 'Pause Trip Playback (Space)' : 'Play Trip Playback (Space)'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5 fill-white" />}
            </button>

            {/* Replay Button */}
            <button
              onClick={handleReplay}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Restart from Beginning"
            >
              <RotateCcw size={16} />
            </button>

            {/* Scrubber Progress Slider */}
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="range"
                min="0"
                max={effectivePoints.length - 1}
                value={currentIndex}
                onChange={(e) => {
                  setCurrentIndex(Number(e.target.value));
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Start: {startPoint?.time || '00:00'}</span>
                <span className="text-white font-bold">{Math.round((currentIndex / Math.max(1, effectivePoints.length - 1)) * 100)}% Completed</span>
                <span>Finish: {endPoint?.time || 'Arrival'}</span>
              </div>
            </div>

            {/* Speed Multiplier Buttons */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl gap-1 text-[11px] font-mono font-bold">
              {[1, 2, 5, 10].map(s => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer ${playbackSpeed === s ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Details Strip */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1 flex-1">
            {startPoint?.address && (
              <div className="flex items-center gap-1.5 text-slate-700 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <span className="font-bold text-slate-500">From:</span>
                <span className="truncate">{startPoint.address}</span>
              </div>
            )}
            {endPoint?.address && (
              <div className="flex items-center gap-1.5 text-slate-700 truncate">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                <span className="font-bold text-slate-500">To:</span>
                <span className="truncate">{endPoint.address}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
            <button
              onClick={() => handleCopy(`${currentPoint.lat.toFixed(5)}, ${currentPoint.lon.toFixed(5)}`)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-mono font-bold text-slate-700 text-xs flex items-center gap-1 cursor-pointer"
              title="Copy GPS coordinates"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{currentPoint.lat.toFixed(4)}, {currentPoint.lon.toFixed(4)}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}