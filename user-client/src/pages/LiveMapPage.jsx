import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTracking } from '../contexts/TrackingContext';
import { createDirectionalVehicleIcon, VehicleCategoryIcon } from '../components/VehicleIcons';
import EngineControlModal from '../components/EngineControlModal';
import ShareLiveTrackingModal from '../components/ShareLiveTrackingModal';
import { Layers, Crosshair, Navigation, Navigation2, Share2, Key, Battery, Gauge, ChevronUp, ChevronDown, Power, Compass, MapPin, Copy, Check, Clock } from 'lucide-react';

const MAP_TILES = {
  googleStreets: {
    name: 'Google Streets HD (Detailed Places & Roads)',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 21,
    maxNativeZoom: 20
  },
  googleHybrid: {
    name: 'Google Satellite & Roads HD',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 21,
    maxNativeZoom: 20
  },
  osm: {
    name: 'OpenStreetMap Standard Atlas',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    maxNativeZoom: 19
  }
};

function formatLastUpdate(timeString) {
  if (!timeString) return 'Real-time (Active)';
  try {
    const d = new Date(timeString);
    if (isNaN(d.getTime())) return 'Active';
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (diffSec < 15) return `Just now (${timeFormatted})`;
    if (diffSec < 60) return `${diffSec}s ago (${timeFormatted})`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago (${timeFormatted})`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m ago (${timeFormatted})`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeFormatted}`;
  } catch {
    return 'Active';
  }
}

function getCardinalDirection(deg) {
  if (typeof deg !== 'number' || isNaN(deg)) return 'N';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
  return directions[index];
}

export default function LiveMapPage() {
  const { liveVehicles, selectedVehicle, setSelectedVehicleId, refreshData } = useTracking();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({});

  const [activeTile, setActiveTile] = useState('googleStreets');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [followVehicle, setFollowVehicle] = useState(true);
  const [isolateSelected, setIsolateSelected] = useState(true); // Isolate selected vehicle on map by default
  const [isSheetExpanded, setIsSheetExpanded] = useState(false); // Collapsed by default so map is full & not cropped
  const [engineTargetVehicle, setEngineTargetVehicle] = useState(null);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [shareTargetVehicle, setShareTargetVehicle] = useState(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = selectedVehicle?.latitude || 25.6528;
    const defaultLng = selectedVehicle?.longitude || 84.969;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });
    mapRef.current = map;

    const tileConf = MAP_TILES[activeTile];
    tileLayerRef.current = L.tileLayer(tileConf.url, {
      maxZoom: tileConf.maxZoom || 20,
      maxNativeZoom: tileConf.maxNativeZoom || 19,
      subdomains: tileConf.subdomains && tileConf.subdomains.length > 0 ? tileConf.subdomains : undefined
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

    map.on('dragstart', () => {
      setFollowVehicle(false);
    });

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

  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const tileConf = MAP_TILES[activeTile];
    tileLayerRef.current = L.tileLayer(tileConf.url, {
      maxZoom: tileConf.maxZoom || 20,
      maxNativeZoom: tileConf.maxNativeZoom || 19,
      subdomains: tileConf.subdomains && tileConf.subdomains.length > 0 ? tileConf.subdomains : undefined
    }).addTo(mapRef.current);

    mapRef.current.invalidateSize();
  }, [activeTile]);

  // Live Vehicle Markers: Isolated single vehicle or all fleet based on user preference
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Isolate selected vehicle if selected and isolateSelected is true
    const vehiclesToDisplay = (isolateSelected && selectedVehicle)
      ? [selectedVehicle]
      : liveVehicles;

    // Remove any markers from the map that should no longer be displayed
    const activeIds = new Set(vehiclesToDisplay.map(v => v.id));
    Object.keys(markersRef.current).forEach(id => {
      const numId = Number(id);
      if (!activeIds.has(numId) && !activeIds.has(id)) {
        if (markersRef.current[id]) {
          markersRef.current[id].remove();
          delete markersRef.current[id];
        }
      }
    });

    vehiclesToDisplay.forEach(v => {
      if (!v.latitude || !v.longitude) return;

      const isSel = selectedVehicle?.id === v.id;
      const icon = createDirectionalVehicleIcon({
        name: v.plateNumber || v.name,
        speed: v.speed,
        course: v.course,
        status: v.status,
        isSelected: isSel,
        category: v.category
      });

      if (!markersRef.current[v.id]) {
        const marker = L.marker([v.latitude, v.longitude], { icon })
          .addTo(map)
          .on('click', () => {
            setSelectedVehicleId(v.id);
            setFollowVehicle(true);
          });
        markersRef.current[v.id] = marker;
      } else {
        const marker = markersRef.current[v.id];
        marker.setLatLng([v.latitude, v.longitude]);
        marker.setIcon(icon);
      }
    });

    if (selectedVehicle?.latitude && selectedVehicle?.longitude && followVehicle) {
      map.panTo([selectedVehicle.latitude, selectedVehicle.longitude], { animate: true, duration: 0.6 });
    }
  }, [liveVehicles, selectedVehicle, followVehicle, isolateSelected]);

  const handleCenterSelected = () => {
    setFollowVehicle(true);
    if (selectedVehicle && mapRef.current) {
      mapRef.current.setView([selectedVehicle.latitude, selectedVehicle.longitude], 16, { animate: true });
    }
  };

  const handleNavigateGoogle = () => {
    if (!selectedVehicle?.latitude) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedVehicle.latitude},${selectedVehicle.longitude}`, '_blank');
  };

  const handleShare = () => {
    if (selectedVehicle) {
      setShareTargetVehicle(selectedVehicle);
    }
  };

  const handleCopyDetailedLocation = () => {
    if (!selectedVehicle) return;
    const str = `${selectedVehicle.name} • ${selectedVehicle.address}\nCoordinates: ${selectedVehicle.latitude?.toFixed(6)}, ${selectedVehicle.longitude?.toFixed(6)}\nSpeed: ${selectedVehicle.speed} km/h`;
    navigator.clipboard.writeText(str);
    setCopiedLocation(true);
    setTimeout(() => setCopiedLocation(false), 2000);
  };

  const isEngineOn = selectedVehicle?.ignition === true || selectedVehicle?.status === 'running';
  const headingCardinal = getCardinalDirection(selectedVehicle?.course || 0);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100 select-none font-sans">
      
      {/* Fullscreen Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Controls Top-Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 transition cursor-pointer"
          title="Map Layer"
        >
          <Layers size={19} />
        </button>

        <button
          onClick={handleCenterSelected}
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-md flex items-center justify-center transition cursor-pointer ${
            followVehicle 
              ? 'bg-blue-600 text-white border-blue-500 font-bold shadow-blue-600/25' 
              : 'bg-white/95 text-slate-700 border-slate-200 hover:text-blue-600'
          }`}
          title="Follow GPS Location"
        >
          <Crosshair size={19} className={followVehicle ? 'animate-spin' : ''} />
        </button>

        {showLayerMenu && (
          <div className="absolute right-0 top-13 bg-white border border-slate-200 rounded-3xl p-2 shadow-2xl space-y-1 w-48 animate-fadeIn">
            {Object.entries(MAP_TILES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTile(key);
                  setShowLayerMenu(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                  activeTile === key 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {val.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Vehicle Switcher Top-Left */}
      <div className="absolute top-4 left-4 right-18 z-20 overflow-x-auto custom-scroll flex items-center gap-1.5 pb-1">
        {selectedVehicle && (
          <button
            onClick={() => setIsolateSelected(!isolateSelected)}
            className={`px-3 py-1.5 rounded-2xl backdrop-blur-md border text-xs font-black shrink-0 transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
              isolateSelected
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25 ring-2 ring-blue-500/20'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-white'
            }`}
            title="Toggle Single Vehicle Isolation vs Full Fleet"
          >
            {isolateSelected ? (
              <>
                <Crosshair size={13} className="text-white shrink-0" />
                <span className="truncate max-w-[130px]">Isolated: {selectedVehicle.plateNumber || selectedVehicle.name}</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-md ml-0.5">Show All</span>
              </>
            ) : (
              <>
                <Layers size={13} className="text-blue-600 shrink-0" />
                <span>All Fleet ({liveVehicles.length})</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.2 rounded-md ml-0.5">Focus Single</span>
              </>
            )}
          </button>
        )}

        {liveVehicles.map(v => {
          const isSel = selectedVehicle?.id === v.id;
          return (
            <button
              key={v.id}
              onClick={() => {
                setSelectedVehicleId(v.id);
                setIsolateSelected(true);
                setFollowVehicle(true);
              }}
              className={`px-3 py-1.5 rounded-2xl backdrop-blur-md border text-xs font-bold shrink-0 transition flex items-center gap-2 shadow-sm cursor-pointer ${
                isSel
                  ? 'bg-white text-blue-600 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
              }`}
            >
              <div className="w-5 h-5 rounded-lg bg-slate-50 flex items-center justify-center p-0.5">
                <VehicleCategoryIcon category={v.category} className="w-full h-full object-contain" />
              </div>
              <span className="truncate max-w-[120px]">{v.plateNumber || v.name}</span>
              <span className={`w-2 h-2 rounded-full ${v.status === 'running' ? 'bg-emerald-500 animate-pulse' : (v.status === 'idle' ? 'bg-amber-500' : 'bg-red-500')}`}></span>
            </button>
          );
        })}
      </div>

      {/* Floating Live Vehicle Details Sheet (Slim by default, tap to expand full) */}
      {selectedVehicle && (
        <div className="absolute bottom-3 left-3 right-3 md:left-6 md:right-auto md:bottom-6 md:w-[440px] z-20">
          <div 
            onClick={() => !isSheetExpanded && setIsSheetExpanded(true)}
            className={`bg-white/98 backdrop-blur-2xl border border-slate-200/90 rounded-3xl shadow-2xl transition-all duration-300 ease-in-out cursor-pointer ${
              isSheetExpanded ? 'p-4 sm:p-5 space-y-3' : 'p-3 hover:bg-white'
            }`}
          >
            {/* Sheet Drag Handle / Indicator */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsSheetExpanded(!isSheetExpanded);
              }}
              className="w-full flex items-center justify-center -mt-1 pb-1 text-slate-300 hover:text-slate-500 cursor-pointer"
            >
              <div className="w-10 h-1 rounded-full bg-slate-300"></div>
            </div>

            {/* Header: Avatar, Name, Status & Live Speed */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-10 shrink-0 p-0.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                  <VehicleCategoryIcon category={selectedVehicle.category} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-tight tracking-tight">
                    {selectedVehicle.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase ${
                      selectedVehicle.status === 'running' ? 'text-emerald-600' : (selectedVehicle.status === 'idle' ? 'text-amber-600' : 'text-red-600')
                    }`}>
                      {selectedVehicle.status === 'running' ? 'Moving' : (selectedVehicle.status === 'idle' ? 'Idling' : 'Parked')}
                    </span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{formatLastUpdate(selectedVehicle.lastUpdate)}</span>
                  </div>
                </div>
              </div>

              {/* Speed & Quick Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-right leading-none">
                  <span className="text-sm font-black text-slate-900 font-mono tabular-nums">{selectedVehicle.speed}</span>
                  <span className="text-[8px] text-slate-400 font-bold block">km/h</span>
                </div>

                {!isSheetExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNavigateGoogle(e);
                    }}
                    className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-xs cursor-pointer"
                    title="Navigate in Google Maps"
                  >
                    <Navigation2 size={14} />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSheetExpanded(!isSheetExpanded);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={isSheetExpanded ? "Collapse" : "Tap for full details"}
                >
                  {isSheetExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
              </div>
            </div>

            {/* Expanded Detailed Location & Telematics Attributes */}
            {isSheetExpanded && (
              <div className="space-y-3 pt-2 border-t border-slate-100 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                {/* 4-Stat Grid */}
                <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Engine</span>
                    <span className={`font-bold flex items-center gap-1 mt-0.5 ${isEngineOn ? 'text-emerald-600' : 'text-slate-600'}`}>
                      <Key size={11} /> {isEngineOn ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Heading</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 font-mono tabular-nums">
                      <Compass size={11} className="text-blue-600" /> {selectedVehicle.course || 0}° {headingCardinal}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Battery</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 font-mono tabular-nums">
                      <Battery size={11} className="text-emerald-600" /> {selectedVehicle.battery}%
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Today Run</span>
                    <span className="font-black text-blue-600 mt-0.5 font-mono tabular-nums">{selectedVehicle.todayDistance} km</span>
                  </div>
                </div>

                {/* Exact High-Precision Coordinates */}
                <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                    <MapPin size={13} className="text-blue-600 shrink-0" />
                    <span>GPS: <strong>{selectedVehicle.latitude?.toFixed(6)}</strong>, <strong>{selectedVehicle.longitude?.toFixed(6)}</strong></span>
                  </div>
                  <button
                    onClick={handleCopyDetailedLocation}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition cursor-pointer"
                    title="Copy Coordinates and Address"
                  >
                    {copiedLocation ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>

                {/* Complete Un-Truncated Detailed Address */}
                <div className="p-2.5 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-start gap-2 text-xs leading-relaxed text-slate-700 font-medium">
                  <MapPin size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wide">Current Location Address:</span>
                    <p className="text-slate-900 font-semibold mt-0.5">{selectedVehicle.address || 'GPS Location active'}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleNavigateGoogle}
                    className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
                  >
                    <Navigation2 size={15} />
                    <span>Navigate</span>
                  </button>

                  <button
                    onClick={() => setEngineTargetVehicle(selectedVehicle)}
                    className={`px-4 py-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 border shadow-xs cursor-pointer ${
                      isEngineOn
                        ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <Power size={15} />
                    <span>{isEngineOn ? 'Stop' : 'Start'}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-emerald-600 border border-slate-200 transition cursor-pointer"
                    title="Share on WhatsApp"
                  >
                    <Share2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {engineTargetVehicle && (
        <EngineControlModal
          vehicle={engineTargetVehicle}
          onClose={() => setEngineTargetVehicle(null)}
          onSuccess={() => refreshData && refreshData()}
        />
      )}

      {shareTargetVehicle && (
        <ShareLiveTrackingModal
          vehicle={shareTargetVehicle}
          onClose={() => setShareTargetVehicle(null)}
        />
      )}
    </div>
  );
}
