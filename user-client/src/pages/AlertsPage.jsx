import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracking } from '../contexts/TrackingContext';
import { VehicleCategoryIcon } from '../components/VehicleIcons';
import {
  Bell,
  Key,
  Zap,
  ShieldAlert,
  Trash2,
  Navigation,
  MapPin,
  Clock,
  Battery,
  WifiOff,
  Gauge,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

function formatAlertTime(isoStr) {
  if (!isoStr) return 'Just now';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;

    const isToday = d.toDateString() === now.toDateString();
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${timePart}`;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timePart}`;
  } catch {
    return 'Recently';
  }
}

export default function AlertsPage() {
  const {
    alerts,
    clearAlerts,
    deleteAlert,
    setSelectedVehicleId,
    liveVehicles
  } = useTracking();

  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('all');

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'all') return true;
    const cat = a.categoryType || '';
    const typ = (a.type || '').toLowerCase();
    if (filterType === 'ignition') return cat === 'ignition' || typ.includes('ignition');
    if (filterType === 'alarm') return cat === 'alarm' || typ.includes('overspeed') || typ.includes('battery');
    if (filterType === 'movement') return cat === 'movement' || typ.includes('moving') || typ.includes('idle');
    if (filterType === 'system') return cat === 'system' || typ.includes('offline');
    return true;
  });

  const handleTrackVehicle = (deviceId) => {
    if (deviceId) {
      setSelectedVehicleId(deviceId);
      navigate('/map');
    }
  };

  const getAlertVisuals = (item) => {
    const typ = (item.type || '').toLowerCase();
    const cat = item.categoryType || '';

    if (typ.includes('speed') || typ.includes('overspeed')) {
      return {
        badge: 'OVERSPEED',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        iconBg: 'bg-red-50 text-red-600 border-red-200',
        icon: <Gauge size={18} />
      };
    }
    if (typ.includes('ignon') || typ === 'ignition_on') {
      return {
        badge: 'IGNITION ON',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        icon: <Key size={18} />
      };
    }
    if (typ.includes('ignoff') || typ === 'ignition_off') {
      return {
        badge: 'PARKED / OFF',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: <Key size={18} className="opacity-60" />
      };
    }
    if (typ.includes('bat') || typ.includes('battery')) {
      return {
        badge: 'LOW BATTERY',
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
        iconBg: 'bg-orange-50 text-orange-600 border-orange-200',
        icon: <Battery size={18} />
      };
    }
    if (typ.includes('idle')) {
      return {
        badge: 'IDLING',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
        icon: <Clock size={18} />
      };
    }
    if (typ.includes('off') || typ.includes('offline')) {
      return {
        badge: 'OFFLINE',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        iconBg: 'bg-slate-100 text-slate-500 border-slate-200',
        icon: <WifiOff size={18} />
      };
    }
    if (typ.includes('mov') || typ.includes('moving')) {
      return {
        badge: 'MOVING',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
        icon: <Navigation size={18} />
      };
    }
    return {
      badge: 'EVENT',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
      icon: <Bell size={18} />
    };
  };

  const ignitionCount = alerts.filter(a => a.categoryType === 'ignition' || a.type?.includes('ignition')).length;
  const criticalCount = alerts.filter(a => a.categoryType === 'alarm' || a.type?.includes('speed') || a.type?.includes('bat')).length;
  const movementCount = alerts.filter(a => a.categoryType === 'movement' || a.type?.includes('mov') || a.type?.includes('idle')).length;
  const systemCount = alerts.filter(a => a.categoryType === 'system' || a.type?.includes('off')).length;

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-none font-sans">
      
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200/90 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Security &amp; Operational Alerts
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time ignition triggers, safety speed alarms, and battery status
          </p>
        </div>

        {alerts.length > 0 && (
          <button
            onClick={clearAlerts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 text-xs font-bold transition cursor-pointer"
            title="Clear all alerts"
          >
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="p-3 bg-white border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto custom-scroll shrink-0">
        {[
          { key: 'all', label: 'All Alerts', count: alerts.length },
          { key: 'ignition', label: 'Ignition Events', count: ignitionCount },
          { key: 'alarm', label: 'Safety & Alarms', count: criticalCount },
          { key: 'movement', label: 'Movement & Idle', count: movementCount },
          { key: 'system', label: 'System & Offline', count: systemCount }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              filterType === f.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>{f.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold tabular-nums ${
              filterType === f.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="flex-1 overflow-y-auto custom-scroll p-3.5 sm:p-5 space-y-3 pb-24">
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-24 text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-2xs">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shadow-2xs">
                <Bell size={28} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">No alerts in this category</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Live ignition transitions, movement updates, and safety alarms will be recorded here automatically with audio alerts.
                </p>
              </div>
            </div>
          ) : (
            filteredAlerts.map((item, idx) => {
              const visuals = getAlertVisuals(item);
              const relatedVehicle = liveVehicles.find(v => v.id === item.deviceId);
              const displayName = item.vehicleName || relatedVehicle?.name || `Vehicle #${item.deviceId}`;
              const displayPlate = item.vehiclePlate || relatedVehicle?.uniqueId || '';
              const displayCategory = item.category || relatedVehicle?.category || 'car';
              const displayAddress = item.address || relatedVehicle?.address || 'GPS Live Coordinates';

              return (
                <div
                  key={item.id || idx}
                  className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-4.5 shadow-2xs hover:shadow-xs transition space-y-3"
                >
                  {/* Top Bar: Vehicle Info + Status Badge + Timestamp */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                        <VehicleCategoryIcon category={displayCategory} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {displayName}
                          </h4>
                          {displayPlate && (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200 shrink-0">
                              {displayPlate}
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border mt-1 ${visuals.badgeClass}`}>
                          <span>{visuals.badge}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono text-slate-400 font-semibold tabular-nums">
                        {formatAlertTime(item.time)}
                      </span>
                      {deleteAlert && (
                        <button
                          onClick={() => deleteAlert(item.id)}
                          className="p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                          title="Dismiss alert"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alert Content Box */}
                  <div className="flex items-start gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${visuals.iconBg}`}>
                      {visuals.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>

                  {/* Location & Track on Map Button */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100/90 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                      <MapPin size={13} className="text-red-500 shrink-0" />
                      <span className="truncate text-[11px] font-medium">{displayAddress}</span>
                    </div>

                    <button
                      onClick={() => handleTrackVehicle(item.deviceId)}
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Navigation size={12} />
                      <span>Track on Map</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
