import React, { useState, useEffect } from 'react';
import { Navigation, ShieldCheck, Activity, Radio, Sparkles } from 'lucide-react';

export default function CustomerAppEntrySplash({ isDataReady = false, minDisplayTimeMs = 1200, onFinished }) {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);
  const [stage, setStage] = useState(0);

  const stages = [
    { title: 'Connecting to Fleet Gateway...', icon: Radio },
    { title: 'Synchronizing Live GPS Trackers...', icon: Activity },
    { title: 'AbsTracker Telematics Active', icon: ShieldCheck }
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 500);
    const t2 = setTimeout(() => setStage(2), 1000);

    const readyTimer = setTimeout(() => {
      setFading(true);
      const closeTimer = setTimeout(() => {
        setShow(false);
        if (onFinished) onFinished();
      }, 450);
      return () => clearTimeout(closeTimer);
    }, minDisplayTimeMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(readyTimer);
    };
  }, [minDisplayTimeMs, onFinished]);

  if (!show) return null;

  const StageIcon = stages[stage].icon;

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-white text-slate-900 select-none p-6 transition-opacity duration-500 ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      {/* Top Brand Spacer */}
      <div className="pt-8 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 font-mono">
          Live Telematics Engine
        </span>
      </div>

      {/* Center Radar & Brand Emblem */}
      <div className="flex flex-col items-center justify-center space-y-6 -mt-8">
        
        {/* Pulsing GPS Radar Rings */}
        <div className="relative flex items-center justify-center">
          {/* Radar Circles */}
          <span className="absolute w-44 h-44 rounded-full border border-blue-200/60 animate-ping" style={{ animationDuration: '3s' }}></span>
          <span className="absolute w-36 h-36 rounded-full border border-blue-300/50 animate-ping" style={{ animationDuration: '2.4s' }}></span>
          <span className="absolute w-28 h-28 rounded-full bg-blue-50/70 border border-blue-200"></span>

          {/* Core Brand Badge */}
          <div className="relative z-10 w-22 h-22 rounded-3xl bg-white p-2.5 shadow-2xl shadow-blue-500/20 border border-slate-100 flex items-center justify-center transform hover:scale-105 transition">
            <img 
              src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" 
              alt="AbsTracker" 
              className="w-full h-full object-contain rounded-2xl" 
            />
          </div>

          {/* Orbiting Satellite Indicator */}
          <div className="absolute w-32 h-32 rounded-full animate-spin" style={{ animationDuration: '4s' }}>
            <div className="w-3.5 h-3.5 rounded-full bg-blue-600 shadow-md shadow-blue-600/50 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
          </div>
        </div>

        {/* Brand Typography */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black tracking-tight font-sans">
            <span className="text-slate-950">Abs</span>
            <span className="text-red-600">Tracker</span>
          </h1>
          <p className="text-base text-blue-600 font-bold block" style={{ fontFamily: "'Dancing Script', cursive" }}>
            Unconditional Aftersales Service
          </p>
        </div>

        {/* Dynamic Telematics Connection Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
          <StageIcon size={14} className="text-blue-600 animate-pulse" />
          <span className="text-xs font-bold text-slate-700 font-mono">
            {stages[stage].title}
          </span>
        </div>
      </div>

      {/* Bottom Loading Progress Bar & Copyright */}
      <div className="w-full max-w-xs space-y-3 text-center pb-4">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 relative">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-red-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: stage === 0 ? '35%' : (stage === 1 ? '75%' : '100%') }}
          ></div>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-semibold">
          <Sparkles size={12} className="text-amber-500" />
          <span>Powered by Abstracker Team</span>
        </div>
      </div>

    </div>
  );
}
