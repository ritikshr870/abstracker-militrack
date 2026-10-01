import React from 'react';
import { Car, Navigation } from 'lucide-react';

export default function VehicleLoadingAnimation({ vehicleNumber = 'AbsTracker Fleet', message = 'Connecting to live vehicles...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 select-none animate-fadeIn">
      {/* Animated Radar Pulse */}
      <div className="relative flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-blue-100/60 border border-blue-200 flex items-center justify-center shadow-inner">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Navigation size={26} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
        {/* Pulsing rings */}
        <span className="absolute -inset-2 rounded-full border-2 border-blue-400 opacity-60 animate-ping" style={{ animationDuration: '2s' }}></span>
        <span className="absolute -inset-4 rounded-full border border-blue-300 opacity-40 animate-ping" style={{ animationDuration: '2.5s' }}></span>
      </div>

      {/* Vehicle Number Badge */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm font-black text-slate-800 text-xs font-mono tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{vehicleNumber}</span>
        </div>
        <p className="text-xs text-slate-500 font-semibold">{message}</p>
      </div>
    </div>
  );
}
