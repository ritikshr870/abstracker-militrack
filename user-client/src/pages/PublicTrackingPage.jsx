import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import axios from 'axios';
import { createDirectionalVehicleIcon, VehicleCategoryIcon } from '../components/VehicleIcons';
import { Gauge, Key, Battery, Navigation, Clock, ShieldAlert, Copy, Check, Compass, AlertCircle, RefreshCw } from 'lucide-react';

function getCardinalDirection(deg) {
  if (typeof deg !== 'number' || isNaN(deg)) return 'N';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
  return directions[index];
}

function formatRemainingTime(expMs) {
  if (!expMs) return 'Active (No Expiry)';
  const diff = expMs - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} left`;
  }
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function PublicTrackingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const expParam = searchParams.get('exp');
  const expTimestamp = expParam ? Number(expParam) : null;
  const initialName = searchParams.get('name') || 'Vehicle';

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpired, setIsExpired] = useState(() => expTimestamp ? Date.now() > expTimestamp : false);
  const [copied, setCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Check expiration immediately
  useEffect(() => {
    if (expTimestamp && Date.now() > expTimestamp) {
      setIsExpired(true);
    }
  }, [expTimestamp]);

  // Fetch public vehicle position
  const fetchPublicVehicle = async () => {
    if (isExpired) return;

    try {
      const url = `/api/public/track/${id}${expTimestamp ? `?exp=${expTimestamp}` : ''}`;
      const res = await axios.get(url, { validateStatus: () => true });

      if (res.status === 410 || res.data?.expired) {
        setIsExpired(true);
        setLoading(false);
        return;
      }

      if (res.status === 200 && res.data) {
        const d = res.data.device || {};
        const p = res.data.position || {};
        const attrs = p.attributes || {};

        let status = d.status || 'stopped';
        const rawSpeed = p.speed || 0;
        const speedKmh = Math.round(rawSpeed > 0 ? (p.speedKmh ? parseFloat(p.speedKmh) : rawSpeed * 1.852) : 0);

        if (speedKmh > 2 || attrs.currentStatus === 'RUNNING') {
          status = 'running';
        } else if (attrs.ignition === true || attrs.currentStatus === 'IDLE') {
          status = 'idle';
        } else if (d.status === 'offline') {
          status = 'offline';
        } else {
          status = 'stopped';
        }

        setVehicle({
          id: d.id,
          name: d.name || initialName,
          category: d.category || 'car',
          status,
          latitude: p.latitude || 25.6528,
          longitude: p.longitude || 84.969,
          speed: speedKmh,
          course: p.course || 0,
          ignition: attrs.ignition === true,
          battery: attrs.batteryLevel || p.battery || 100,
          address: p.address || 'Live GPS Location',
          updatedAt: p.deviceTime || p.serverTime || new Date().toISOString()
        });
        setLastRefreshed(new Date());
        setError(null);
      } else {
        setError(res.data?.error || 'Unable to locate vehicle');
      }
    } catch (err) {
      if (err.response?.status === 410) {
        setIsExpired(true);
      } else if (!vehicle) {
        setError('Failed to connect to telematics server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicVehicle();
    const interval = setInterval(fetchPublicVehicle, 7000);
    return () => clearInterval(interval);
  }, [id, isExpired]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || isExpired) return;

    if (!mapRef.current) {
      const defaultLat = vehicle?.latitude || 25.6528;
      const defaultLng = vehicle?.longitude || 84.969;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });
      mapRef.current = map;

      // Google Streets HD - Full Detailed Roads, Villages, Landmarks & Small Places
      tileLayerRef.current = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        maxNativeZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps'
      }).addTo(map);

      // Guaranteed tile rendering: invalidateSize at 100ms, 300ms, and 800ms
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 100);
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);
      setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 800);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isExpired]);

  // Update map marker when vehicle coordinates update
  useEffect(() => {
    if (!mapRef.current || !vehicle?.latitude || !vehicle?.longitude) return;

    const map = mapRef.current;
    const icon = createDirectionalVehicleIcon({
      name: vehicle.name,
      speed: vehicle.speed,
      course: vehicle.course,
      status: vehicle.status,
      isSelected: true,
      category: vehicle.category
    });

    if (!markerRef.current) {
      markerRef.current = L.marker([vehicle.latitude, vehicle.longitude], { icon }).addTo(map);
      map.setView([vehicle.latitude, vehicle.longitude], 16, { animate: true });
    } else {
      markerRef.current.setLatLng([vehicle.latitude, vehicle.longitude]);
      markerRef.current.setIcon(icon);
      map.panTo([vehicle.latitude, vehicle.longitude], { animate: true, duration: 0.6 });
    }
  }, [vehicle]);

  const handleCopyAddress = () => {
    if (!vehicle?.address) return;
    navigator.clipboard.writeText(`${vehicle.name}: ${vehicle.address}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoogleMaps = () => {
    if (!vehicle?.latitude) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${vehicle.latitude},${vehicle.longitude}`, '_blank');
  };

  // 1. Expired Link State
  if (isExpired) {
    return (
      <div className="fixed inset-0 w-full h-full bg-slate-900 flex items-center justify-center p-4 select-none font-sans text-white">
        <div className="bg-slate-800/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-9 max-w-sm w-full text-center space-y-4 shadow-2xl animate-slideUp">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Tracking Link Expired</h2>
            <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
              Yeh live tracking link expire ho chuka hai. Kripya gaadi ke owner se naya link generate karne ko kahein.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-700/60 text-xs text-slate-500 font-medium">
            AbsTracker Telematics Suite • Powered by Abstracker Team
          </div>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading && !vehicle) {
    return (
      <div className="fixed inset-0 w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white space-y-3 font-sans">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-300">Connecting to {initialName}...</p>
      </div>
    );
  }

  // 3. Error State
  if (error && !vehicle) {
    return (
      <div className="fixed inset-0 w-full h-full bg-slate-900 flex items-center justify-center p-4 select-none font-sans text-white">
        <div className="bg-slate-800/90 border border-white/10 rounded-3xl p-7 max-w-sm w-full text-center space-y-3 shadow-2xl">
          <AlertCircle size={36} className="text-amber-500 mx-auto" />
          <h3 className="text-base font-black">Vehicle Inactive</h3>
          <p className="text-xs text-slate-400">{error}</p>
          <button 
            onClick={fetchPublicVehicle}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const isMoving = vehicle?.status === 'running';
  const isIdle = vehicle?.status === 'idle';
  const headingCardinal = getCardinalDirection(vehicle?.course || 0);

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-100 flex flex-col overflow-hidden select-none font-sans">
      
      {/* Top Floating Brand & Expiry Header */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3.5 py-2 shadow-md flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-0.5">
            <img src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" alt="Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <div className="flex items-center gap-0 leading-none font-black text-xs tracking-tight">
              <span className="text-slate-900">Abs</span>
              <span className="text-red-600">Tracker</span>
              <span className="ml-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200">
                LIVE
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block leading-tight mt-0.5">
              Live Guest Viewer
            </span>
          </div>
        </div>

        {/* Link Expiration Pill */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md text-white border border-slate-700 rounded-2xl px-3 py-1.5 shadow-md flex items-center gap-1.5 text-xs font-bold">
          <Clock size={13} className="text-amber-400" />
          <span className="font-mono text-[11px]">{formatRemainingTime(expTimestamp)}</span>
        </div>
      </div>

      {/* Fullscreen Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Re-center Button */}
      <button
        onClick={() => {
          if (mapRef.current && vehicle?.latitude) {
            mapRef.current.setView([vehicle.latitude, vehicle.longitude], 16, { animate: true });
          }
        }}
        className="absolute top-18 right-3 z-20 w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-blue-600 transition cursor-pointer"
        title="Center Vehicle"
      >
        <Navigation size={18} />
      </button>

      {/* Bottom Live Tracking Vehicle Card */}
      {vehicle && (
        <div className="absolute bottom-3 left-3 right-3 md:left-6 md:right-auto md:w-[420px] z-30">
          <div className="bg-white/98 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3 animate-slideUp">
            
            {/* Header: Avatar, Name, Status Badge, Live Speed */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-13 h-12 shrink-0 p-0.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                  <VehicleCategoryIcon category={vehicle.category} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight tracking-tight">
                    {vehicle.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-500 font-semibold capitalize">
                      {vehicle.category}
                    </span>
                    <span className="text-[10px] text-slate-300">•</span>
                    <span className={`text-[10px] font-bold uppercase ${
                      isMoving ? 'text-emerald-600' : (isIdle ? 'text-amber-600' : 'text-red-600')
                    }`}>
                      {isMoving ? 'Moving' : (isIdle ? 'Idling' : 'Parked')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                <Gauge size={16} className={isMoving ? 'text-emerald-600' : 'text-slate-400'} />
                <div className="text-right leading-none">
                  <span className="text-base font-black text-slate-900 font-mono tabular-nums">{vehicle.speed}</span>
                  <span className="text-[9px] text-slate-500 font-bold block">km/h</span>
                </div>
              </div>
            </div>

            {/* Telematics Attribute Grid */}
            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Engine</span>
                <span className={`font-bold flex items-center gap-1 mt-0.5 ${vehicle.ignition ? 'text-emerald-600' : 'text-slate-600'}`}>
                  <Key size={11} /> {vehicle.ignition ? 'ON' : 'OFF'}
                </span>
              </div>

              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Heading</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 font-mono tabular-nums">
                  <Compass size={11} className="text-blue-600" /> {vehicle.course || 0}° {headingCardinal}
                </span>
              </div>

              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Battery</span>
                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 font-mono tabular-nums">
                  <Battery size={11} className={vehicle.battery < 20 ? 'text-red-500' : 'text-emerald-500'} /> {vehicle.battery}%
                </span>
              </div>

              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Status</span>
                <span className={`font-bold mt-0.5 block truncate ${isMoving ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {isMoving ? 'Moving' : (isIdle ? 'Idling' : 'Parked')}
                </span>
              </div>
            </div>

            {/* Address & Quick Navigation */}
            <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Current Landmark &amp; Address</span>
                  <p className="font-semibold text-slate-800 text-[11px] leading-snug mt-0.5">
                    {vehicle.address}
                  </p>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="shrink-0 p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 transition shadow-2xs cursor-pointer"
                  title="Copy address"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>

              <button
                onClick={handleGoogleMaps}
                className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-blue-600 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs mt-1"
              >
                <Navigation size={13} />
                <span>Navigate in Google Maps</span>
              </button>
            </div>

            {/* Footer Branding */}
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Feed Updated</span>
              </span>
              <span>Powered by Abstracker Team</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
