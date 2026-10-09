import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTracking } from '../contexts/TrackingContext';
import { 
  LogOut, ShieldCheck, PhoneCall, Sparkles, Mail, Phone
} from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { stats } = useTracking();

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 p-4 sm:p-6 overflow-y-auto custom-scroll pb-28 select-none font-sans">
      <div className="max-w-2xl mx-auto w-full space-y-4">
        
        {/* Profile Identity Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-600/25 shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-900 leading-tight truncate">
              {user?.name || 'AbsTracker Customer'}
            </h2>
            <p className="text-xs text-slate-500 font-semibold truncate">{user?.email || 'fleet@abstracker.org'}</p>
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
              <ShieldCheck size={12} /> Active Telematics Service
            </div>
          </div>
        </div>

        {/* Fleet Overview Grid */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3.5 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Fleet Summary Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Monitored</span>
              <span className="text-xl font-black text-slate-900 font-mono tabular-nums">{stats.total}</span>
            </div>
            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
              <span className="text-[10px] text-emerald-600 font-bold uppercase block">Moving Now</span>
              <span className="text-xl font-black text-emerald-700 font-mono tabular-nums">{stats.running}</span>
            </div>
            <div className="bg-red-50/60 p-3.5 rounded-2xl border border-red-100">
              <span className="text-[10px] text-red-600 font-bold uppercase block">Parked</span>
              <span className="text-xl font-black text-red-700 font-mono tabular-nums">{stats.stopped}</span>
            </div>
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
              <span className="text-[10px] text-amber-600 font-bold uppercase block">Idling</span>
              <span className="text-xl font-black text-amber-700 font-mono tabular-nums">{stats.idle}</span>
            </div>
          </div>
        </div>

        {/* Customer Care & Support */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3.5 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Customer Care &amp; Support</h3>
          <div className="space-y-2.5 text-xs">
            
            {/* Phone Support */}
            <a 
              href="tel:+919123200739" 
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/70 border border-slate-100 hover:border-blue-200 transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Phone size={17} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone Support</span>
                  <span className="font-black text-slate-900 group-hover:text-blue-600 font-mono text-sm tracking-wide">
                    91232 00739
                  </span>
                </div>
              </div>
              <span className="font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl text-xs group-hover:bg-blue-600 group-hover:text-white transition">
                Call Now
              </span>
            </a>

            {/* Email Support */}
            <a 
              href="mailto:info@abstracker.in" 
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-100 hover:border-emerald-200 transition cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Mail size={17} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Email Support</span>
                  <span className="font-black text-slate-900 group-hover:text-emerald-700 font-mono text-xs sm:text-sm">
                    info@abstracker.in
                  </span>
                </div>
              </div>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl text-xs group-hover:bg-emerald-600 group-hover:text-white transition">
                Send Mail
              </span>
            </a>

            {/* Service Guarantee */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="flex items-center gap-2.5 font-bold text-slate-700">
                <Sparkles size={16} className="text-amber-500" /> Service Guarantee
              </span>
              <span className="font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl">Unconditional</span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <LogOut size={16} />
          <span>Sign Out of Account</span>
        </button>

        <div className="pt-2 text-center text-xs text-slate-400 space-y-0.5">
          <p className="font-bold text-slate-700">AbsTracker Telematics Suite</p>
          <p className="font-semibold text-slate-500">Powered by Abstracker Team</p>
        </div>
      </div>
    </div>
  );
}
