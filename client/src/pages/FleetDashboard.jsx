import React, { useState } from 'react';
import { useFleet } from '../contexts/FleetContext';
import { 
  Search, Truck, Gauge, StopCircle, AlertTriangle, MapPin, Bolt, 
  Navigation, X, LayoutGrid, Table, Copy, Check, Compass
} from 'lucide-react';
import MapModal from '../components/MapModal';
import CommandModal from '../components/CommandModal';
import { VehicleCategoryIcon } from '../components/VehicleIcons';

export default function FleetDashboard() {
  const { fleet, kpis, loading } = useFleet();
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [commandDevice, setCommandDevice] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Compute live breakdown
  const runningCount = fleet.filter(i => {
    const s = (i.position?.attributes?.currentStatus || (i.device?.status === 'offline' ? 'OFFLINE' : 'STOPPED')).toUpperCase();
    return s === 'RUNNING';
  }).length;

  const stoppedCount = fleet.filter(i => {
    const s = (i.position?.attributes?.currentStatus || (i.device?.status === 'offline' ? 'OFFLINE' : 'STOPPED')).toUpperCase();
    return s === 'STOPPED';
  }).length;

  const offlineCount = fleet.filter(i => {
    const s = (i.position?.attributes?.currentStatus || (i.device?.status === 'offline' ? 'OFFLINE' : 'STOPPED')).toUpperCase();
    return s === 'OFFLINE';
  }).length;

  // Filter items
  const filteredFleet = fleet.filter(item => {
    const d = item.device || {};
    const p = item.position || {};
    const attr = p.attributes || {};
    const status = (attr.currentStatus || (d.status === 'offline' ? 'OFFLINE' : 'STOPPED')).toUpperCase();

    if (filter === 'RUNNING' && status !== 'RUNNING') return false;
    if (filter === 'STOPPED' && status !== 'STOPPED') return false;
    if (filter === 'OFFLINE' && status !== 'OFFLINE') return false;

    if (search) {
      const q = search.toLowerCase();
      const matchName = d.name && d.name.toLowerCase().includes(q);
      const matchImei = d.uniqueId && d.uniqueId.includes(q);
      const matchAddress = p.address && p.address.toLowerCase().includes(q);
      const matchDriver = attr.driverName && attr.driverName.toLowerCase().includes(q);
      return matchName || matchImei || matchAddress || matchDriver;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredFleet.length / pageSize) || 1;
  const currentFleet = filteredFleet.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCopy = (text, id, e) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scroll flex flex-col gap-4 bg-slate-50/50">
      <div className="max-w-[1450px] mx-auto w-full space-y-4">

        {/* Clean Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-5 py-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Fleet Overview</h2>
            <p className="text-xs text-slate-500">Live GPS tracking and status for all registered vehicles</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
              Total Vehicles: <strong className="text-slate-900 font-black">{fleet.length}</strong>
            </span>
          </div>
        </div>

        {/* 4 Clean Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div 
            onClick={() => { setFilter('ALL'); setCurrentPage(1); }}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${filter === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-xs'}`}
          >
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${filter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>Total Vehicles</p>
              <h3 className="text-2xl font-black font-mono mt-0.5">{fleet.length}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
              <Truck size={20} />
            </div>
          </div>

          <div 
            onClick={() => { setFilter('RUNNING'); setCurrentPage(1); }}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${filter === 'RUNNING' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-xs'}`}
          >
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${filter === 'RUNNING' ? 'text-emerald-100' : 'text-emerald-600'}`}>Running</p>
              <h3 className={`text-2xl font-black font-mono mt-0.5 ${filter === 'RUNNING' ? 'text-white' : 'text-emerald-600'}`}>{runningCount}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'RUNNING' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <Gauge size={20} />
            </div>
          </div>

          <div 
            onClick={() => { setFilter('STOPPED'); setCurrentPage(1); }}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${filter === 'STOPPED' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-xs'}`}
          >
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${filter === 'STOPPED' ? 'text-amber-100' : 'text-amber-600'}`}>Stopped</p>
              <h3 className={`text-2xl font-black font-mono mt-0.5 ${filter === 'STOPPED' ? 'text-white' : 'text-amber-600'}`}>{stoppedCount}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'STOPPED' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <StopCircle size={20} />
            </div>
          </div>

          <div 
            onClick={() => { setFilter('OFFLINE'); setCurrentPage(1); }}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${filter === 'OFFLINE' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-xs'}`}
          >
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${filter === 'OFFLINE' ? 'text-red-100' : 'text-red-600'}`}>Offline</p>
              <h3 className={`text-2xl font-black font-mono mt-0.5 ${filter === 'OFFLINE' ? 'text-white' : 'text-red-600'}`}>{offlineCount}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${filter === 'OFFLINE' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-600'}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs gap-3">
          
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs font-bold">
            {[
              { key: 'ALL', label: 'All Vehicles', count: fleet.length },
              { key: 'RUNNING', label: 'Running', count: runningCount },
              { key: 'STOPPED', label: 'Stopped', count: stoppedCount },
              { key: 'OFFLINE', label: 'Offline', count: offlineCount }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${
                  filter === f.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${filter === f.key ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & View Switcher */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search vehicle, plate, driver, location..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-red-600"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Table View"
              >
                <Table size={15} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                title="Cards View"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Vehicle List: Table View (Default) */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <div className="inline-flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
              <span className="font-bold text-xs">Loading vehicle positions...</span>
            </div>
          </div>
        ) : filteredFleet.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <Truck size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-700 text-sm">No vehicles found</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing the search or changing the filter.</p>
          </div>
        ) : viewMode === 'table' ? (

          /* CLEAN SPREADSHEET TABLE */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 min-w-[950px]">
                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3.5">Vehicle</th>
                    <th className="px-4 py-3.5">Plate / IMEI</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Speed</th>
                    <th className="px-4 py-3.5">Ignition</th>
                    <th className="px-4 py-3.5">Today Dist</th>
                    <th className="px-4 py-3.5">Current Location</th>
                    <th className="px-4 py-3.5">Last Seen</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {currentFleet.map(item => {
                    const d = item.device || {};
                    const p = item.position || {};
                    const attr = p.attributes || {};
                    const status = (attr.currentStatus || d.status || 'OFFLINE').toUpperCase();

                    const rawSpeed = p.speed ? Number(p.speed) : 0;
                    const speedKmh = Math.round(rawSpeed * 1.852);
                    const dist = attr.todayDistance ? (attr.todayDistance / 1000).toFixed(2) + ' km' : '0.00 km';
                    const address = p.address || 'Resolving location coordinates...';
                    const lastSeen = d.lastUpdate ? new Date(d.lastUpdate).toLocaleTimeString('en-IN', { hour12: true }) : 'N/A';

                    return (
                      <tr
                        key={d.id || d.uniqueId}
                        onClick={() => setSelectedVehicle(item)}
                        className="hover:bg-slate-50 transition cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 flex items-center gap-2.5">
                            <div className="w-10 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1 shrink-0 shadow-2xs">
                              <VehicleCategoryIcon category={d.category} model={d.model} className="w-full h-full object-contain" />
                            </div>
                            <div>
                              <span className="hover:text-red-600 transition block leading-tight">{d.name || 'Unnamed'}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {d.model || 'GPS'} • <span className="capitalize">{d.category || 'Car'}</span>
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono text-slate-600">
                          {d.uniqueId}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            status === 'RUNNING' ? 'bg-emerald-50 text-emerald-700' :
                            status === 'STOPPED' ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'RUNNING' ? 'bg-emerald-500' : status === 'STOPPED' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                            {status === 'RUNNING' ? 'Running' : status === 'STOPPED' ? 'Stopped' : 'Offline'}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {speedKmh} km/h
                        </td>

                        <td className="px-4 py-3">
                          {attr.ignition ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">ON</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[10px]">OFF</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-700">{dist}</td>

                        <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={address}>
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-red-500 flex-shrink-0" />
                            <span className="truncate">{address}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{lastSeen}</td>

                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedVehicle(item)}
                            title="Live Track & Playback"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition inline-flex items-center gap-1 shadow-xs"
                          >
                            <Navigation size={12} />
                            <span>Track</span>
                          </button>
                          <button
                            onClick={() => setCommandDevice(item)}
                            title="Send Command"
                            className="px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition inline-flex items-center"
                          >
                            <Bolt size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        ) : (

          /* CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentFleet.map(item => {
              const d = item.device || {};
              const p = item.position || {};
              const attr = p.attributes || {};
              const status = (attr.currentStatus || d.status || 'OFFLINE').toUpperCase();

              const rawSpeed = p.speed ? Number(p.speed) : 0;
              const speedKmh = Math.round(rawSpeed * 1.852);
              const isRunning = status === 'RUNNING';
              const coords = p.latitude && p.longitude ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` : 'N/A';
              const todayDist = attr.todayDistance ? (attr.todayDistance / 1000).toFixed(1) + ' km' : '0.0 km';
              const address = p.address || 'Resolving location...';
              const lastSeen = d.lastUpdate ? new Date(d.lastUpdate).toLocaleTimeString('en-IN', { hour12: true }) : 'N/A';

              return (
                <div
                  key={d.id || d.uniqueId}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-4 border-b border-slate-100 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-11 h-9 rounded-xl border border-slate-200/80 flex items-center justify-center p-1 shrink-0 ${isRunning ? 'bg-emerald-50/60' : 'bg-slate-50'}`}>
                          <VehicleCategoryIcon category={d.category} model={d.model} className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm truncate max-w-[160px]">{d.name || 'Vehicle'}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">{d.uniqueId}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isRunning ? 'bg-emerald-50 text-emerald-700' :
                        status === 'STOPPED' ? 'bg-amber-50 text-amber-700' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {isRunning ? 'Running' : status === 'STOPPED' ? 'Stopped' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-black font-mono ${isRunning ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {speedKmh}
                        </span>
                        <span className="text-xs font-bold text-slate-400">km/h</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${attr.ignition ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        Ignition {attr.ignition ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2 text-xs flex-1">
                    <div className="flex items-start gap-1 text-slate-600">
                      <MapPin size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[11px] line-clamp-2">{address}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                      <span>Today: <strong className="text-slate-900 font-bold">{todayDist}</strong></span>
                      <span>Time: {lastSeen}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedVehicle(item)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Navigation size={12} />
                      <span>Track</span>
                    </button>
                    <button
                      onClick={() => setCommandDevice(item)}
                      title="Send Command"
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition flex items-center justify-center"
                    >
                      <Bolt size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2 text-slate-600">
            <span>Showing</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-xs font-semibold focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>vehicles | Total matching: <strong className="text-slate-900 font-bold">{filteredFleet.length}</strong></span>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3 py-1 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Prev
            </button>
            <span className="px-3 font-mono font-bold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-3 py-1 border border-slate-200 rounded-lg bg-white font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* Modals */}
      {selectedVehicle && (
        <MapModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
        />
      )}

      {commandDevice && (
        <CommandModal
          device={commandDevice}
          onClose={() => setCommandDevice(null)}
        />
      )}
    </div>
  );
}
