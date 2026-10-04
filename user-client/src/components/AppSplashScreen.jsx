import React, { useState, useEffect } from 'react';
import { ShieldCheck, Radio, Wifi, Zap } from 'lucide-react';

export default function AppSplashScreen({ message = 'Initializing Telematics Engine...' }) {
  const [pulseIndex, setPulseIndex] = useState(0);

  const steps = [
    'Connecting Telematics Stream...',
    'Synchronizing Fleet Hardware...',
    'Establishing Zero-Drift GPS Link...',
    'System Ready • AbsTracker Fleet Active'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % steps.length);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-white select-none p-6 overflow-hidden">
      
      {/* Background Animated Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        {/* Subtle Radar Scan Line */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-40 animate-radar"></div>
      </div>

      {/* Top Header Badge */}
      <div className="pt-8 sm:pt-12 z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span className="text-[11px] font-bold tracking-widest uppercase text-blue-200">
          AbsTracker Telematics OS
        </span>
      </div>

      {/* Center Hero: Glowing Logo with Concentric Pulse Rings */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto space-y-6">
        
        {/* Concentric Telemetry Rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-44 h-44 rounded-full border border-blue-500/20 animate-ping" style={{ animationDuration: '3s' }}></div>
          <div className="absolute w-36 h-36 rounded-full border border-blue-400/30 animate-pulse" style={{ animationDuration: '2s' }}></div>
          <div className="absolute w-28 h-28 rounded-full bg-blue-600/20 blur-xl"></div>
          
          {/* Logo Card with Glossy Glass Finish */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1 bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 shadow-2xl shadow-blue-500/40 transform hover:scale-105 transition duration-500">
            <div className="w-full h-full rounded-[22px] bg-slate-950/80 backdrop-blur-md p-2 flex items-center justify-center overflow-hidden border border-white/20">
              <img
                src="/abstracker-logo.jpg"
                alt="AbsTracker Logo"
                className="w-full h-full object-contain filter drop-shadow-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>

        {/* Brand Name & Typography */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-cyan-300">
            ABSTRACKER
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-blue-200/80 tracking-widest uppercase">
            Fleet Telematics & Vehicle Security
          </p>
        </div>

        {/* Dynamic Telemetry Status Bar */}
        <div className="flex flex-col items-center space-y-2.5 pt-2">
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-300">
            <Radio size={14} className="text-cyan-400 animate-pulse" />
            <span>{steps[pulseIndex] || message}</span>
          </div>

          {/* Smooth Linear Progress Indicator */}
          <div className="w-48 sm:w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 rounded-full animate-indeterminate"></div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Service Pledge & Security Seal */}
      <div className="pb-4 sm:pb-8 z-10 flex flex-col items-center space-y-1.5 text-center">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Unconditional Aftersales Service</span>
        </div>
        <p className="text-[10px] text-slate-500 tracking-wider">
          Enterprise GPS Engine • 24x7 Real-time Protection
        </p>
      </div>

    </div>
  );
}
