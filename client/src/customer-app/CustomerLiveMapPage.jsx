import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { useCustomerTracking } from './CustomerTrackingContext';
import { 
  createMap, 
  setMapLayer, 
  updateVehicleMarkerWithBuffer, 
  smoothFollowVehicle, 
  isValidCoord, 
  MAP_PROVIDERS, 
  getVehicleLocalHistory,
  calculateBearing 
} from './map';
import { createDirectionalVehicleIcon, VehicleCategoryIcon } from './CustomerVehicleIcons';
import EngineControlModal from './EngineControlModal';
import { Layers, Crosshair, Key, Battery, Gauge, ChevronUp, ChevronDown, Power, Clock, Compass, Plus, Minus, Route } from 'lucide-react';

export default function CustomerLiveMapPage() {
  const { liveVehicles, selectedVehicle, selectedVehicleId, setSelectedVehicleId, refreshData } = useCustomerTracking();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const markersRef = useRef({});

  const [activeTile, setActiveTile] = useState('voyager');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [followVehicle, setFollowVehicle] = useState(true);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [engineTargetVehicle, setEngineTargetVehicle] = useState(null);

  // Initialize unified Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const firstValid = liveVehicles.find(v => isValidCoord(v.latitude, v.longitude));
    const startLat = selectedVehicle && isValidCoord(selectedVehicle.latitude, selectedVehicle.longitude) 
      ? selectedVehicle.latitude 
      : (firstValid?.latitude || 25.6528);
    const startLng = selectedVehicle && isValidCoord(selectedVehicle.latitude, selectedVehicle.longitude) 
      ? selectedVehicle.longitude 
      : (firstValid?.longitude || 84.969);

    const { map, layerGroup } = createMap(mapContainerRef.current, [startLat, startLng], 15, 'voyager');
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    map.on('dragstart', () => {
      setFollowVehicle(false);
    });

    return () => {
      Object.values(markersRef.current).forEach(marker => {
        try {
          if (marker._telematicsGlider) marker._telematicsGlider.destroy();
          map.removeLayer(marker);
        } catch (e) {}
      });
      markersRef.current = {};
      try {
        map.remove();
      } catch (e) {}
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

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleCenterSelected = () => {
    setFollowVehicle(true);
    if (selectedVehicle && mapInstanceRef.current && isValidCoord(selectedVehicle.latitude, selectedVehicle.longitude)) {
      mapInstanceRef.current.setView([selectedVehicle.latitude, selectedVehicle.longitude], 16, { animate: true });
    }
  };

  // Update live vehicle markers with DOM STABILITY (Zero Icon Thrashing)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Purge any stale markers no longer in liveVehicles (prevents ghost/duplicate icons)
    const validVehicleIds = new Set(liveVehicles.map(v => v.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!validVehicleIds.has(Number(id))) {
        const stale = markersRef.current[id];
        if (stale) {
          if (stale._telematicsGlider) stale._telematicsGlider.destroy();
          try { map.removeLayer(stale); } catch (e) {}
        }
        delete markersRef.current[id];
      }
    });

    liveVehicles.forEach(v => {
      if (!isValidCoord(v.latitude, v.longitude)) return;

      const isSel = selectedVehicle?.id === v.id;
      let marker = markersRef.current[v.id];

      if (!marker) {
        // Initial marker creation
        const icon = createDirectionalVehicleIcon({
          name: v.name,
          category: v.category,
          speed: v.speed,
          course: v.course,
          status: v.status,
          isSelected: isSel
        });

        marker = L.marker([v.latitude, v.longitude], {
          icon,
          zIndexOffset: isSel ? 1000 : (v.status === 'running' ? 500 : 10)
        }).addTo(map);

        marker.on('click', () => {
          setSelectedVehicleId(v.id);
          setFollowVehicle(true);
        });

        markersRef.current[v.id] = marker;
        marker._cachedMeta = {
          category: v.category,
          status: v.status,
          isSel: isSel,
          name: v.name
        };

        updateVehicleMarkerWithBuffer(marker, v);
      } else {
        // Marker already exists: Check if DOM icon actually needs replacing
        const prevMeta = marker._cachedMeta || {};
        const metaChanged = (
          prevMeta.isSel !== isSel ||
          prevMeta.status !== v.status ||
          prevMeta.category !== v.category ||
          prevMeta.name !== v.name
        );

        if (metaChanged) {
          // Preserve current glider bearing so it NEVER snaps to 0° or resets
          const currentBearing = marker._telematicsGlider 
            ? marker._telematicsGlider.currentBearing 
            : (v.course || 0);

          const icon = createDirectionalVehicleIcon({
            name: v.name,
            category: v.category,
            speed: v.speed,
            course: currentBearing,
            status: v.status,
            isSelected: isSel
          });

          marker.setIcon(icon);
          marker.setZIndexOffset(isSel ? 1000 : (v.status === 'running' ? 500 : 10));
          marker._cachedMeta = {
            category: v.category,
            status: v.status,
            isSel: isSel,
            name: v.name
          };
        } else {
          // DOM is stable! Just update speed badge text in place without destroying Leaflet element!
          const el = marker.getElement();
          if (el) {
            const speedBadge = el.querySelector('.live-speed-badge');
            if (speedBadge) {
              speedBadge.textContent = `${v.speed} km/h`;
              speedBadge.style.display = (v.status === 'running' && v.speed > 0) ? 'block' : 'none';
            }
            const halo = el.querySelector('.moving-halo');
            if (halo) {
              halo.style.display = v.status === 'running' ? 'block' : 'none';
            }
          }
        }

        // Feed GPS packet into Glider buffer
        updateVehicleMarkerWithBuffer(marker, v);
      }
    });

    // Real-time camera follow centering without any polyline path
    if (selectedVehicle) {
      const selectedMarker = markersRef.current[selectedVehicle.id];
      if (selectedMarker && selectedMarker._telematicsGlider) {
        const glider = selectedMarker._telematicsGlider;
        glider.onPositionUpdate = (lat, lng, bearing) => {
          if (followVehicle && selectedVehicle?.id === glider.deviceId) {
            smoothFollowVehicle(map, lat, lng);
          }
        };
      }
    }

    // Camera follow centering
    if (followVehicle && selectedVehicle && isValidCoord(selectedVehicle.latitude, selectedVehicle.longitude)) {
      smoothFollowVehicle(map, selectedVehicle.latitude, selectedVehicle.longitude);
    }
  }, [liveVehicles, selectedVehicle, followVehicle, selectedVehicleId]);

  const isEngineOn = selectedVehicle?.ignition === true || selectedVehicle?.status === 'running';

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-100 select-none">
      
      {/* Map DOM canvas */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-0" 
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} 
      />

      {/* Floating Controls Top-Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg flex items-center justify-center text-slate-700 hover:text-blue-600 transition cursor-pointer"
          title="Map Layer"
        >
          <Layers size={19} />
        </button>

        <button
          onClick={handleCenterSelected}
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-lg flex items-center justify-center transition cursor-pointer ${
            followVehicle 
              ? 'bg-blue-600 text-white border-blue-500 font-bold' 
              : 'bg-white/95 text-slate-700 border-slate-200 hover:text-blue-600'
          }`}
          title="Follow GPS Location"
        >
          <Crosshair size={19} className={followVehicle ? 'animate-spin' : ''} />
        </button>

        {/* Zoom Controls */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg flex flex-col overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="w-11 h-10 flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition border-b border-slate-100 cursor-pointer"
            title="Zoom In"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-11 h-10 flex items-center justify-center text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition cursor-pointer"
            title="Zoom Out"
          >
            <Minus size={18} />
          </button>
        </div>

        {showLayerMenu && (
          <div className="absolute right-0 top-13 bg-white border border-slate-200 rounded-3xl p-2 shadow-2xl space-y-1 w-64 animate-fadeIn z-30">
            {Object.entries(MAP_PROVIDERS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleSwitchLayer(key)}
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

      {/* Top Floating Vehicle Selector */}
      <div className="absolute top-4 left-4 right-20 z-20">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg p-2 flex items-center gap-2">
          <div className="w-8 h-8 shrink-0">
            <VehicleCategoryIcon category={selectedVehicle?.category} className="w-full h-full object-contain" />
          </div>
          <select
            value={selectedVehicle?.id || ''}
            onChange={(e) => {
              const id = parseInt(e.target.value);
              setSelectedVehicleId(id);
              setFollowVehicle(true);
            }}
            className="flex-1 bg-transparent text-sm font-black text-slate-900 focus:outline-none font-mono cursor-pointer"
          >
            {liveVehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.status?.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom Live Vehicle Floating Status Sheet */}
      {selectedVehicle && (
        <div className="absolute bottom-2 left-3 right-3 z-20">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
            
            {/* Sheet Handle */}
            <div 
              onClick={() => setIsSheetExpanded(!isSheetExpanded)}
              className="p-3.5 cursor-pointer flex items-center justify-between border-b border-slate-100 hover:bg-slate-50/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-9 shrink-0">
                  <VehicleCategoryIcon category={selectedVehicle.category} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base font-mono tracking-tight leading-tight">
                    {selectedVehicle.name}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-1 max-w-[240px] font-semibold">
                    {selectedVehicle.address || 'Address updating...'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                  selectedVehicle.status === 'running' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : (selectedVehicle.status === 'idle' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')
                }`}>
                  {selectedVehicle.status}
                </span>
                {isSheetExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50 border-b border-slate-100 text-center text-[10px]">
              <div className="p-1">
                <span className="text-slate-400 font-semibold block">Speed</span>
                <span className="font-black text-blue-600 text-xs">{selectedVehicle.speed || 0} km/h</span>
              </div>
              <div className="p-1">
                <span className="text-slate-400 font-semibold block">Ignition</span>
                <span className={`font-black text-xs ${isEngineOn ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {isEngineOn ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="p-1">
                <span className="text-slate-400 font-semibold block">Battery</span>
                <span className="font-black text-slate-700 text-xs inline-flex items-center gap-1">
                  <Battery size={13} className={(selectedVehicle.battery ?? 100) < 20 ? 'text-red-500' : 'text-emerald-600'} />
                  <span>{`${selectedVehicle.battery ?? 100}%`}</span>
                </span>
              </div>
              <div className="p-1">
                <span className="text-slate-400 font-semibold block">Updated</span>
                <span className="font-black text-slate-700 text-xs">{selectedVehicle.relativeTime || 'Just now'}</span>
              </div>
            </div>

            {/* Expanded Detailed Attributes & Engine Control */}
            {isSheetExpanded && (
              <div className="p-3.5 space-y-3 bg-white animate-fadeIn">
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Coordinates:</span>
                    <span className="font-mono font-bold text-slate-700">
                      {selectedVehicle.latitude?.toFixed(5)}, {selectedVehicle.longitude?.toFixed(5)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">GPS Time:</span>
                    <span className="font-bold text-slate-700">{selectedVehicle.exactTime || 'N/A'}</span>
                  </div>
                </div>

                {/* Engine Cut/Restore Control Button */}
                <button
                  onClick={() => setEngineTargetVehicle(selectedVehicle)}
                  className={`w-full py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md ${
                    isEngineOn
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  <Power size={15} />
                  <span>{isEngineOn ? 'Stop Engine (Immobilize Vehicle)' : 'Restore Engine Power'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Engine Security Dialog */}
      {engineTargetVehicle && (
        <EngineControlModal
          vehicle={engineTargetVehicle}
          onClose={() => setEngineTargetVehicle(null)}
          onSuccess={() => refreshData()}
        />
      )}
    </div>
  );
}
