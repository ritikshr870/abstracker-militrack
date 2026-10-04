import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Car, Map, History, FileText, Bell, User, Volume2, VolumeX, RefreshCw, Download, BellRing, Smartphone } from 'lucide-react';
import { useTracking } from '../contexts/TrackingContext';
import NotificationSettingsModal from './NotificationSettingsModal';
import { getNotificationPermission } from '../utils/notificationManager';

export default function Layout() {
  const { stats, alerts, soundEnabled, setSoundEnabled, refreshData, loading } = useTracking();
  const location = useLocation();
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifPerm, setNotifPerm] = useState(getNotificationPermission());

  useEffect(() => {
    setNotifPerm(getNotificationPermission());
  }, []);

  const navItems = [
    { to: '/', label: 'Vehicles', icon: Car, count: stats.total },
    { to: '/map', label: 'Live Map', icon: Map },
    { to: '/history', label: 'Playback', icon: History },
    { to: '/reports', label: 'Reports', icon: FileText },
    { to: '/alerts', label: 'Alerts', icon: Bell, badge: alerts.length > 0 ? alerts.length : null },
    { to: '/profile', label: 'Profile', icon: User }
  ];

  return (
    <div className="w-full h-full min-h-[100dvh] flex flex-col bg-slate-100 text-slate-900 overflow-hidden relative font-sans">
      
      {/* Brand Top Header */}
      <header className="h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 flex items-center justify-between shrink-0 z-30 pt-safe shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shadow-xs shrink-0">
            <img 
              src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" 
              alt="AbsTracker Logo" 
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                e.target.style.display = 'none';
              }} 
            />
          </div>
          <div>
            <div className="flex items-center gap-0 leading-none font-black text-sm sm:text-base tracking-tight font-sans">
              <span className="text-slate-900">Abs</span>
              <span className="text-red-600">Tracker</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-normal tracking-normal block mt-0.5 font-sans">
              Unconditional Aftersales Service
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links (>= md) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all relative select-none ${
                  isActive
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-500'} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full ml-0.5">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Controls: Install App, Notification Bell, Live Status, Refresh, and Sound Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Active Fleet Counter Badge */}
          <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="hidden sm:inline">Fleet</span>
            <span className="font-mono">{stats.running}/{stats.total}</span>
          </div>

          {/* Push Notification Alerts Bell Button */}
          <button
            onClick={() => setShowNotificationModal(true)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-2xl border flex items-center justify-center transition cursor-pointer relative shadow-2xs ${
              notifPerm === 'granted'
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-700'
            }`}
            title={notifPerm === 'granted' ? 'Notification Alert Settings (Active)' : 'Enable Push Notifications'}
          >
            <BellRing size={15} />
            {notifPerm !== 'granted' && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </button>

          {/* Refresh Action */}
          <button
            onClick={() => refreshData && refreshData()}
            disabled={loading}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
            title="Refresh Fleet Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          {/* Audio Chime Toggle */}
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
            title={soundEnabled ? 'Alert Chime Active' : 'Alert Chime Muted'}
          >
            {soundEnabled ? <Volume2 size={15} className="text-blue-600" /> : <VolumeX size={15} className="text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-slate-50/70">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar for Mobile (< md) */}
      <nav className="md:hidden h-16 bg-white/98 backdrop-blur-xl border-t border-slate-200/90 px-2 flex items-center justify-around shrink-0 z-30 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all relative select-none cursor-pointer ${
                isActive 
                  ? 'text-blue-600 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon size={19} className={isActive ? 'scale-110 text-blue-600 transition-transform' : ''} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-0.5"></span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Push Notification Permissions & Settings Modal */}
      {showNotificationModal && (
        <NotificationSettingsModal 
          onClose={() => {
            setShowNotificationModal(false);
            setNotifPerm(getNotificationPermission());
          }} 
        />
      )}
    </div>
  );
}
