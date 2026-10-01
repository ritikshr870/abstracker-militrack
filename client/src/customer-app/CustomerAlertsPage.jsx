import React, { useState, useEffect, useMemo } from 'react';
import { useCustomerTracking, formatRelativeTime, cleanAddress } from './CustomerTrackingContext';
import { VehicleCategoryIcon } from './CustomerVehicleIcons';
import axios from 'axios';
import { 
  Bell,
  MapPin, Key, ShieldAlert, Volume2, VolumeX, AlertTriangle, 
  Radio, RefreshCw, Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  Gauge, PowerOff, Navigation, Clock, Send
} from 'lucide-react';

const ITEMS_PER_PAGE = 25;

export function formatIndianEventTime(dateString, serverTimeStr) {
  if (serverTimeStr) return serverTimeStr;
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(dateString);
  }
}

// User directive: Inspect received notifications and show EXACT human name
export function getExactNotificationDetails(item = {}) {
  const rawType = (item.type || '').toLowerCase();
  const alarmType = (item.attributes?.alarm || '').toLowerCase();

  // 1. Alarms check (Parking, Overspeed, SOS, PowerCut, etc.)
  if (rawType.includes('alarm')) {
    if (alarmType.includes('parking')) {
      return {
        title: 'Parking Alarm',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: ShieldAlert,
        iconColor: 'text-amber-600'
      };
    }
    if (alarmType.includes('overspeed')) {
      return {
        title: 'Overspeed Alert',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        icon: Gauge,
        iconColor: 'text-red-600'
      };
    }
    if (alarmType.includes('sos')) {
      return {
        title: 'SOS Emergency Alarm',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        icon: ShieldAlert,
        iconColor: 'text-red-600'
      };
    }
    if (alarmType.includes('powercut')) {
      return {
        title: 'Power Cut (Wire Disconnected)',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        icon: PowerOff,
        iconColor: 'text-red-600'
      };
    }
    return {
      title: 'Security Alarm',
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      icon: ShieldAlert,
      iconColor: 'text-red-600'
    };
  }

  // 2. Engine ON
  if (rawType.includes('ignitionon')) {
    return {
      title: 'Engine ON',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Key,
      iconColor: 'text-emerald-600'
    };
  }

  // 3. Engine OFF
  if (rawType.includes('ignitionoff')) {
    return {
      title: 'Engine OFF',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: PowerOff,
      iconColor: 'text-slate-500'
    };
  }

  // 4. Online
  if (rawType.includes('deviceonline') || rawType === 'online') {
    return {
      title: 'Online',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Radio,
      iconColor: 'text-emerald-600'
    };
  }

  // 5. Offline
  if (rawType.includes('deviceoffline') || rawType === 'offline') {
    return {
      title: 'Offline',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: Radio,
      iconColor: 'text-rose-500'
    };
  }

  // 6. Overspeed
  if (rawType.includes('overspeed')) {
    return {
      title: 'Overspeed Alert',
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
      icon: Gauge,
      iconColor: 'text-red-600'
    };
  }

  // 7. Vehicle Moving
  if (rawType.includes('moving')) {
    return {
      title: 'Vehicle Moving',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Navigation,
      iconColor: 'text-blue-600'
    };
  }

  // 8. Vehicle Stopped
  if (rawType.includes('stopped')) {
    return {
      title: 'Vehicle Stopped',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock,
      iconColor: 'text-amber-600'
    };
  }

  // 9. Geofence Enter / Exit
  if (rawType.includes('geofenceenter')) {
    return {
      title: 'Geofence Entered',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: CheckCircle2,
      iconColor: 'text-blue-600'
    };
  }

  if (rawType.includes('geofenceexit')) {
    return {
      title: 'Geofence Exited',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-600'
    };
  }

  // 10. Hardware Commands
  if (rawType.includes('commandsend')) {
    return {
      title: 'Command Sent',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Send,
      iconColor: 'text-indigo-600'
    };
  }

  if (rawType.includes('commandresult')) {
    return {
      title: 'Command Executed',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600'
    };
  }

  return {
    title: rawType.replace(/([A-Z])/g, ' $1').trim() || 'Vehicle Notification',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Bell,
    iconColor: 'text-blue-600'
  };
}

export default function CustomerAlertsPage() {
  const { liveVehicles, devicesMap, positionsMap, soundEnabled, setSoundEnabled } = useCustomerTracking();
  const [filterType, setFilterType] = useState('all');
  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch real server telematics events for customer vehicles rapidly in batches
  const loadAllEvents = async () => {
    setIsRefreshing(true);

    let targetVehicles = liveVehicles;
    if (!targetVehicles || targetVehicles.length === 0) {
      try {
        const devRes = await axios.get('/api/devices');
        if (Array.isArray(devRes.data) && devRes.data.length > 0) {
          targetVehicles = devRes.data;
        }
      } catch (e) {}
    }

    if (!targetVehicles || targetVehicles.length === 0) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    const from = new Date(Date.now() - 3 * 86400000).toISOString();
    const to = new Date().toISOString();

    try {
      const chunkSize = 30;
      const chunks = [];
      for (let i = 0; i < targetVehicles.length; i += chunkSize) {
        chunks.push(targetVehicles.slice(i, i + chunkSize));
      }

      const promises = chunks.map(chunk => {
        const params = new URLSearchParams();
        chunk.forEach(v => params.append('deviceId', v.id));
        params.append('from', from);
        params.append('to', to);
        return axios.get(`/api/reports/events?${params.toString()}`)
          .then(res => Array.isArray(res.data) ? res.data : [])
          .catch(() => []);
      });

      const results = await Promise.all(promises);
      let all = results.flat();

      // Sort newest first
      all.sort((a, b) => new Date(b.serverTime || b.eventTime) - new Date(a.serverTime || a.eventTime));

      setEventsList(all);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllEvents();
  }, [liveVehicles.length]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  const filteredEvents = useMemo(() => {
    return eventsList.filter(item => {
      if (filterType === 'all') return true;
      const t = (item.type || '').toLowerCase();
      if (filterType === 'ignition') return t.includes('ignition');
      if (filterType === 'online_offline') return t.includes('online') || t.includes('offline');
      if (filterType === 'overspeed') return t.includes('overspeed');
      if (filterType === 'alarm') return t.includes('alarm');
      return true;
    });
  }, [eventsList, filterType]);

  // Pagination calculation (25 per page)
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEvents.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEvents, currentPage]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden select-none">
      
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs shrink-0">
        <div>
          <h2 className="text-base font-black text-slate-900">Vehicle Notifications</h2>
          <p className="text-xs text-slate-500 font-medium">
            Total {eventsList.length} events • Page {currentPage} of {totalPages}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllEvents}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
            title="Refresh Alerts"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
          >
            {soundEnabled ? <Volume2 size={14} className="text-blue-600" /> : <VolumeX size={14} className="text-slate-400" />}
            <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="p-3 bg-white border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto shrink-0 custom-scroll">
        {[
          { key: 'all', label: `All (${eventsList.length})` },
          { key: 'ignition', label: 'Engine ON / OFF' },
          { key: 'online_offline', label: 'Online / Offline' },
          { key: 'overspeed', label: 'Overspeed' },
          { key: 'alarm', label: 'Alarms' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              filterType === f.key ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications Feed */}
      <div className="flex-1 overflow-y-auto custom-scroll p-3.5 space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 space-y-2">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-xs font-bold text-slate-600">Loading all notifications...</p>
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div className="text-center py-28 text-slate-400 space-y-2">
            <Bell size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No notifications found</p>
            <p className="text-xs text-slate-500">Real-time alerts will appear here as vehicles operate.</p>
          </div>
        ) : (
          paginatedEvents.map((item, idx) => {
            const matchedVehicle = liveVehicles.find(v => v.id === item.deviceId) || devicesMap[item.deviceId] || {};
            const vehicleName = item.attributes?.deviceName || matchedVehicle.name || 'AbsTracker';
            const vehicleCategory = matchedVehicle.category || 'car';

            const details = getExactNotificationDetails(item);
            const IconComponent = details.icon;
            const formattedTime = formatIndianEventTime(item.serverTime || item.eventTime, item['Server Time']);

            return (
              <div
                key={item.id || idx}
                className="bg-white border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Category icon with subtle round box */}
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 p-1 shrink-0 flex items-center justify-center">
                    <VehicleCategoryIcon category={vehicleCategory} className="w-full h-full object-contain" />
                  </div>

                  <div className="min-w-0">
                    {/* Vehicle Registration Number & Exact Name */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        {vehicleName}
                      </span>

                      {/* Exact Name Badge (Engine ON, Engine OFF, Online, Offline, Overspeed, Parking Alarm) */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${details.badgeClass}`}>
                        <IconComponent size={12} className={details.iconColor} />
                        <span>{details.title}</span>
                      </span>
                    </div>

                    {/* Exact Indian Standard Time */}
                    <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      🕒 {formattedTime}
                    </p>

                    {/* Vehicle Location Display as requested */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium mt-1 max-w-[280px]">
                      <MapPin size={12} className="text-blue-500 shrink-0" />
                      <span className="truncate">
                        {(() => {
                          const pos = (positionsMap && positionsMap[item.deviceId]) || matchedVehicle.rawPosition || {};
                          if (item.attributes?.address) return cleanAddress(item.attributes.address, pos.latitude, pos.longitude, matchedVehicle.status);
                          if (pos.address) return cleanAddress(pos.address, pos.latitude, pos.longitude, matchedVehicle.status);
                          if (matchedVehicle.address && !matchedVehicle.address.includes('updating')) return matchedVehicle.address;
                          if (pos.latitude && pos.longitude) return `Location (${Number(pos.latitude).toFixed(3)}, ${Number(pos.longitude).toFixed(3)})`;
                          return 'Patna Region, Bihar';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Relative Time Pill */}
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    {formatRelativeTime(item.serverTime || item.eventTime)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls Bar (Page System) */}
      {totalPages > 1 && (
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 z-20 pb-20 shadow-lg">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-xs font-black text-slate-700 flex items-center gap-1 transition cursor-pointer"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
            <span>Page</span>
            <span className="font-black text-blue-600 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 font-mono">
              {currentPage}
            </span>
            <span>of</span>
            <span className="font-mono font-bold text-slate-900">{totalPages}</span>
            <span className="text-[11px] text-slate-400 font-normal ml-1">
              ({filteredEvents.length} items)
            </span>
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-xs font-black text-slate-700 flex items-center gap-1 transition cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
