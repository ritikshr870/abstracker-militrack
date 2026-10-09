import React from 'react';
import { Navigation } from 'lucide-react';

export default function VehicleLoadingAnimation({ vehicleNumber = 'AbsTracker Fleet', message = 'Connecting to live vehicles...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3.5 select-none animate-fadeIn">
      {/* Professional Smooth Spinner Ring */}
      <div className="relative flex items-center justify-center w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
        <div className="absolute inset-0 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-xs">
          <Navigation size={16} className="text-indigo-600 fill-indigo-600/20" />
        </div>
      </div>

      {/* Vehicle Plate Badge & Status */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200/90 rounded-xl shadow-2xs font-black text-slate-800 text-xs font-mono tracking-wide">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{vehicleNumber}</span>
        </div>
        <p className="text-[11px] text-slate-500 font-semibold">{message}</p>
      </div>
    </div>
  );
}
