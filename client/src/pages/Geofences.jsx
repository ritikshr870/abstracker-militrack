import React from 'react';
import { useFleet } from '../contexts/FleetContext';
import { MapPin, Users, Shield } from 'lucide-react';

export default function Geofences() {
  const { allGeofences, allGroups } = useFleet();

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scroll">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Geofences Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">Active Geofences</h3>
              <p className="text-xs text-slate-500">Virtual containment boundaries</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 font-bold text-xs border border-red-200">
              {allGeofences.length} Fences
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scroll">
            {allGeofences.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No active containment geofences registered</p>
            ) : (
              allGeofences.map(g => (
                <div key={g.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:bg-slate-100/70 transition">
                  <div>
                    <strong className="text-slate-900 font-bold flex items-center gap-1.5">
                      <MapPin size={13} className="text-red-500" />
                      {g.name}
                    </strong>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {g.area ? (g.area.length > 35 ? g.area.substring(0, 35) + '...' : g.area) : 'Polygon Area'}
                    </p>
                  </div>
                  <span className="text-[10px] bg-red-100 text-red-700 px-2.5 py-0.5 rounded-md font-bold">
                    Zone #{g.id}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Groups Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">Vehicle Fleet Groups</h3>
              <p className="text-xs text-slate-500">Organizational fleet clusters</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold text-xs">
              {allGroups.length} Groups
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scroll">
            {allGroups.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No organizational fleet groups established</p>
            ) : (
              allGroups.map(g => (
                <div key={g.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-700">
                      <Users size={13} />
                    </div>
                    <strong className="text-slate-900 font-bold">{g.name}</strong>
                  </div>
                  <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded-md font-mono font-bold">
                    ID: {g.id}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

