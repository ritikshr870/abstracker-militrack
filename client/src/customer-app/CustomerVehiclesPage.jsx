import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomerTracking } from './CustomerTrackingContext';
import { VehicleCategoryIcon } from './CustomerVehicleIcons';
import EngineControlModal from './EngineControlModal';
import VehicleLoadingAnimation from './VehicleLoadingAnimation';
import { Search, Navigation, Play, MapPin, Key, Battery, Copy, Check, Power, Gauge, Clock, RefreshCw } from 'lucide-react';

export default function CustomerVehiclesPage() {
  const {
    filteredVehicles,
    setSelectedVehicleId,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    stats,
    loading,
    isRefreshing,
    handleManualRefresh,
    refreshData
  } = useCustomerTracking();

  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState(null);
  const [engineTargetVehicle, setEngineTargetVehicle] = useState(null);

  // Pull-to-refresh touch tracking
  const [pullY, setPullY] = useState(0);
  const touchStartRef = useRef(0);

  const handleTouchStart = (e) => {
    if (e.currentTarget.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY;
    } else {
      touchStartRef.current = 0;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current > 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartRef.current;
      if (diff > 0) {
        setPullY(Math.min(diff * 0.45, 80));
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullY > 45) {
      handleManualRefresh();
    }
    setPullY(0);
    touchStartRef.current = 0;
  };

  const filterTabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'running', label: 'Moving', count: stats.running },
    { key: 'stopped', label: 'Parked', count: stats.stopped },
    { key: 'idle', label: 'Idle', count: stats.idle },
    { key: 'offline', label: 'Inactive', count: stats.offline }
  ];

  const handleCopyAddress = (e, id, address) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleTrackOnMap = (id) => {
    setSelectedVehicleId(id);
    navigate('/app/map');
  };

  const handlePlayback = (e, id) => {
    e.stopPropagation();
    setSelectedVehicleId(id);
    navigate('/app/history');
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden select-none">
      
      {/* Pull Down to Refresh Visual Bar */}
      {pullY > 0 && (
        <div 
          style={{ height: `${pullY}px` }} 
          className="w-full bg-blue-50 border-b border-blue-200 flex items-center justify-center transition-all overflow-hidden"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
            <RefreshCw size={15} className={pullY > 45 ? 'animate-spin' : ''} />
            <span>{pullY > 45 ? 'Release to Refresh' : 'Pull down to refresh'}</span>
          </div>
        </div>
      )}

      {/* Search Header */}
      <div className="p-3.5 pb-2.5 bg-white border-b border-slate-200 space-y-2.5 shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vehicle number..."
              className="w-full bg-slate-100/90 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={handleManualRefresh}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                filterStatus === tab.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filterStatus === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Cards List with Touch Pull-to-Refresh */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto custom-scroll p-3.5 space-y-3.5 pb-28"
      >
        {loading && filteredVehicles.length === 0 ? (
          <VehicleLoadingAnimation vehicleNumber="AbsTracker Fleet" message="Connecting to live GPS hardware..." />
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-24 text-slate-400 space-y-2">
            <p className="text-sm font-bold text-slate-700">No vehicles found</p>
            <p className="text-xs text-slate-500">Try changing the status tab or search query.</p>
          </div>
        ) : (
          filteredVehicles.map(v => {
            const isMoving = v.status === 'running';
            const isIdle = v.status === 'idle';
            const isOffline = v.status === 'offline';
            const isEngineOn = v.ignition === true || isMoving;

            return (
              <div
                key={v.id}
                onClick={() => handleTrackOnMap(v.id)}
                className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-3 relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  isMoving ? 'bg-emerald-500' : (isIdle ? 'bg-amber-500' : (isOffline ? 'bg-slate-400' : 'bg-red-500'))
                }`}></div>

                {/* Card Header: Avatar & Vehicle Number ONLY (No category text) */}
                <div className="flex items-start justify-between gap-2.5 pt-0.5">
                  <div className="flex items-center gap-3">
                    <div className="w-15 h-14 shrink-0 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                      <VehicleCategoryIcon category={v.category} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      {/* ONLY Vehicle Number */}
                      <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition leading-tight font-mono tracking-tight">
                        {v.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 font-medium">
                        <Clock size={11} className="text-slate-400" />
                        <span>{v.relativeTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    isMoving 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : (isIdle 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : (isOffline 
                              ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'))
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      isMoving ? 'bg-emerald-500 animate-pulse' : (isIdle ? 'bg-amber-500' : (isOffline ? 'bg-slate-400' : 'bg-red-500'))
                    }`}></span>
                    <span>{isMoving ? `LIVE ${v.speed} km/h` : (isIdle ? 'Idle' : (isOffline ? 'Offline' : 'Parked'))}</span>
                  </span>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 text-[11px]">
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-bold">Engine</span>
                    <span className={`font-bold flex items-center gap-1 mt-0.5 ${isEngineOn ? 'text-emerald-600' : 'text-slate-600'}`}>
                      <Key size={12} className={isEngineOn ? 'text-emerald-500' : 'text-slate-400'} />
                      <span>{isEngineOn ? 'ON' : 'OFF'}</span>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-bold">Speed</span>
                    <span className={`font-black flex items-center gap-1 mt-0.5 ${
                      isMoving ? 'text-blue-600 text-sm font-mono' : 'text-slate-800 text-xs'
                    }`}>
                      <Gauge size={14} className={isMoving ? 'text-blue-600 animate-pulse' : 'text-slate-400'} />
                      <span>{v.speed} km/h</span>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-bold">Battery</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Battery size={12} className={v.battery < 20 ? 'text-red-500' : 'text-emerald-500'} />
                      <span>{v.battery}%</span>
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-bold">Today Run</span>
                    <span className="font-black text-blue-600 mt-0.5 font-mono text-sm">
                      {v.todayDistance} km
                    </span>
                  </div>
                </div>

                {/* Address Row with Copy */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 text-slate-700 text-xs leading-relaxed line-clamp-2">
                    <MapPin size={14} className="text-red-600 shrink-0 mt-0.5" />
                    <span>{v.address}</span>
                  </div>
                  <button
                    onClick={(e) => handleCopyAddress(e, v.id, v.address)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition shrink-0 cursor-pointer"
                    title="Copy Address"
                  >
                    {copiedId === v.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Actions (NO Navigation button) */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => handleTrackOnMap(v.id)}
                    className="flex-1 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20 cursor-pointer"
                  >
                    <Navigation size={14} />
                    <span>Track Live</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEngineTargetVehicle(v);
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      isEngineOn
                        ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <Power size={14} />
                    <span>{isEngineOn ? 'Stop Engine' : 'Start Engine'}</span>
                  </button>

                  <button
                    onClick={(e) => handlePlayback(e, v.id)}
                    className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200/80 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="Trip Playback"
                  >
                    <Play size={14} />
                    <span>Playback</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

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
