import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracking } from '../contexts/TrackingContext';
import { VehicleCategoryIcon } from '../components/VehicleIcons';
import EngineControlModal from '../components/EngineControlModal';
import ShareLiveTrackingModal from '../components/ShareLiveTrackingModal';
import VehicleLoadingAnimation from '../components/VehicleLoadingAnimation';
import { Search, Navigation, Share2, Play, MapPin, Key, Battery, Navigation2, Copy, Check, Power, Gauge, Compass } from 'lucide-react';

export default function VehiclesPage() {
  const {
    filteredVehicles,
    setSelectedVehicleId,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    stats,
    loading,
    refreshData
  } = useTracking();

  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState(null);
  const [engineTargetVehicle, setEngineTargetVehicle] = useState(null);
  const [shareTargetVehicle, setShareTargetVehicle] = useState(null);

  const filterTabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'running', label: 'Running', count: stats.running },
    { key: 'not_moving', label: 'Not Moving', count: stats.not_moving },
    { key: 'idle', label: 'Idle', count: stats.idle },
    { key: 'parked', label: 'Parked', count: stats.parked },
    { key: 'offline', label: 'Offline', count: stats.offline }
  ];

  const handleCopyAddress = (e, id, address) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleTrackOnMap = (id) => {
    setSelectedVehicleId(id);
    navigate('/map');
  };

  const handleNavigateGoogle = (e, lat, lng) => {
    e.stopPropagation();
    if (!lat || !lng) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleShare = (e, v) => {
    e.stopPropagation();
    setShareTargetVehicle(v);
  };

  const handlePlayback = (e, id) => {
    e.stopPropagation();
    setSelectedVehicleId(id);
    navigate('/history');
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-none font-sans">
      
      {/* Search & Filter Header */}
      <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200/90 space-y-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vehicle number or plate..."
              className="w-full bg-slate-100/90 border border-slate-200/90 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                filterStatus === tab.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold tabular-nums ${
                filterStatus === tab.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Cards Responsive Grid */}
      <div className="flex-1 overflow-y-auto custom-scroll p-3.5 sm:p-5 pb-24">
        {loading && filteredVehicles.length === 0 ? (
          <VehicleLoadingAnimation vehicleNumber="AbsTracker Fleet" message="Connecting to live GPS hardware..." />
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-24 text-slate-400 space-y-2 max-w-sm mx-auto">
            <p className="text-sm font-bold text-slate-700">No vehicles match criteria</p>
            <p className="text-xs text-slate-500">Try switching to the "All" status filter or clearing your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 max-w-7xl mx-auto">
            {filteredVehicles.map(v => {
              const isMoving = v.status === 'running';
              const isIdle = v.status === 'idle';
              const isOffline = v.status === 'offline';
              const isEngineOn = v.ignition === true || isMoving;

              return (
                <div
                  key={v.id}
                  onClick={() => handleTrackOnMap(v.id)}
                  className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all active:scale-[0.99] cursor-pointer space-y-3 relative overflow-hidden group flex flex-col justify-between"
                >
                  {/* Status Indicator Stripe */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isMoving ? 'bg-emerald-500' : (isIdle ? 'bg-amber-500' : (isOffline ? 'bg-slate-400' : 'bg-red-500'))
                  }`}></div>

                  <div className="space-y-3">
                    {/* Header: Avatar, Name, Category & Status Pill */}
                    <div className="flex items-start justify-between gap-2.5 pt-0.5">
                      <div className="flex items-center gap-3">
                        <div className="w-13 h-12 shrink-0 p-0.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                          <VehicleCategoryIcon category={v.category} className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition leading-tight tracking-tight">
                            {v.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5 capitalize">
                            {v.category}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                        isMoving 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs' 
                          : (isIdle 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : (isOffline 
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                                  : 'bg-red-50 text-red-700 border border-red-200'))
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          isMoving ? 'bg-emerald-500 animate-pulse' : (isIdle ? 'bg-amber-500' : (isOffline ? 'bg-slate-400' : 'bg-red-500'))
                        }`}></span>
                        <span className="font-mono tabular-nums">{isMoving ? `${v.speed} km/h` : (isIdle ? 'Idle' : (isOffline ? 'Offline' : 'Parked'))}</span>
                      </span>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-4 gap-2 bg-slate-50/90 p-3 rounded-2xl border border-slate-100 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Engine</span>
                        <span className={`font-bold flex items-center gap-1 mt-0.5 ${isEngineOn ? 'text-emerald-600' : 'text-slate-600'}`}>
                          <Key size={12} className={isEngineOn ? 'text-emerald-500' : 'text-slate-400'} />
                          <span>{isEngineOn ? 'ON' : 'OFF'}</span>
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Speed</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 font-mono tabular-nums">
                          <Gauge size={12} className={isMoving ? 'text-blue-600' : 'text-slate-400'} />
                          <span>{v.speed} km/h</span>
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Battery</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 font-mono tabular-nums">
                          <Battery size={12} className={v.battery < 20 ? 'text-red-500' : 'text-emerald-500'} />
                          <span>{v.battery}%</span>
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">Today Run</span>
                        <span className="font-black text-blue-600 mt-0.5 font-mono tabular-nums">
                          {v.todayDistance} km
                        </span>
                      </div>
                    </div>

                    {/* Address Row with Copy Feedback */}
                    <div className="flex items-start justify-between gap-2 pt-0.5">
                      <div className="flex items-start gap-1.5 text-slate-600 text-xs leading-relaxed line-clamp-2">
                        <MapPin size={14} className="text-red-600 shrink-0 mt-0.5" />
                        <span className="font-medium">{v.address}</span>
                      </div>
                      <button
                        onClick={(e) => handleCopyAddress(e, v.id, v.address)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition shrink-0 cursor-pointer"
                        title="Copy Address"
                      >
                        {copiedId === v.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2">
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
                      className={`px-3 py-2.5 rounded-2xl text-xs font-black transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                        isEngineOn
                          ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <Power size={14} />
                      <span>{isEngineOn ? 'Stop' : 'Start'}</span>
                    </button>

                    <button
                      onClick={(e) => handleNavigateGoogle(e, v.latitude, v.longitude)}
                      className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200/80 cursor-pointer"
                      title="Navigate on Google Maps"
                    >
                      <Navigation2 size={15} className="text-blue-600" />
                    </button>

                    <button
                      onClick={(e) => handlePlayback(e, v.id)}
                      className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200/80 cursor-pointer"
                      title="Trip Playback"
                    >
                      <Play size={15} />
                    </button>

                    <button
                      onClick={(e) => handleShare(e, v)}
                      className="p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition border border-emerald-200 cursor-pointer"
                      title="Share on WhatsApp"
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
