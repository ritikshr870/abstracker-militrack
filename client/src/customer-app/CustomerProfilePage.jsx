import React from 'react';
import { useCustomerTracking } from './CustomerTrackingContext';
import { LogOut, ShieldCheck, PhoneCall, Sparkles } from 'lucide-react';

export default function CustomerProfilePage() {
  const { stats, handleCustomerLogout } = useCustomerTracking();

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 p-4 space-y-4 overflow-y-auto custom-scroll pb-28 select-none">
      
      {/* Customer Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-600/25">
          A
        </div>
        <div>
          <h2 className="text-base font-black text-slate-900">AbsTracker Customer</h2>
          <p className="text-xs text-slate-500 font-semibold">Verified Fleet Account</p>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
            <ShieldCheck size={13} /> Active Telematics Service
          </div>
        </div>
      </div>

      {/* Fleet Summary Stats */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4.5 space-y-3 shadow-xs">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">My Vehicles Fleet</h3>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-400 font-bold uppercase block">Total Monitored</span>
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
          </div>
          <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
            <span className="text-xs text-emerald-600 font-bold uppercase block">Moving Now</span>
            <span className="text-2xl font-black text-emerald-700">{stats.running}</span>
          </div>
          <div className="bg-red-50/60 p-3.5 rounded-2xl border border-red-100">
            <span className="text-xs text-red-600 font-bold uppercase block">Parked</span>
            <span className="text-2xl font-black text-red-700">{stats.stopped}</span>
          </div>
          <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
            <span className="text-xs text-amber-600 font-bold uppercase block">Idling</span>
            <span className="text-2xl font-black text-amber-700">{stats.idle}</span>
          </div>
        </div>
      </div>

      {/* Customer Support */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4.5 space-y-3 shadow-xs">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Customer Support</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="flex items-center gap-2 font-bold text-slate-700">
              <PhoneCall size={16} className="text-blue-600" /> 24/7 Helpline
            </span>
            <span className="font-bold text-blue-600">Active</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="flex items-center gap-2 font-bold text-slate-700">
              <Sparkles size={16} className="text-amber-500" /> Service Guarantee
            </span>
            <span className="font-bold text-amber-600">Unconditional</span>
          </div>
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={handleCustomerLogout}
        className="w-full py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
      >
        <LogOut size={16} />
        <span>Log Out of Account</span>
      </button>

      <div className="pt-2 text-center text-xs text-slate-400">
        <p className="font-bold text-slate-700">AbsTracker Mobile v2.0</p>
        <p className="font-semibold text-slate-400 mt-0.5">Powered by Abstracker Team</p>
      </div>
    </div>
  );
}
