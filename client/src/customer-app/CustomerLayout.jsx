import InstallAppBanner from './InstallAppBanner';
import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Car, Map, History, FileText, Bell, User, Volume2, VolumeX } from 'lucide-react';
import { useCustomerTracking } from './CustomerTrackingContext';
import CustomerAuthScreen from './CustomerAuthScreen';
import CustomerAppEntrySplash from './CustomerAppEntrySplash';

export default function CustomerLayout() {
  React.useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault();
      window.__deferredInstallPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa_prompt_available'));
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);
  const { stats, alerts, soundEnabled, setSoundEnabled, isCustomerLoggedOut } = useCustomerTracking();
  const location = useLocation();

  // If customer logged out from /app, show Customer Auth Screen right here (NEVER redirect to admin /login!)
  if (isCustomerLoggedOut) {
    return <CustomerAuthScreen />;
  }

  const navItems = [
    { to: '/app', label: 'Vehicles', icon: Car, count: stats.total, exact: true },
    { to: '/app/map', label: 'Live Map', icon: Map },
    { to: '/app/history', label: 'Playback', icon: History },
    { to: '/app/reports', label: 'Reports', icon: FileText },
    { to: '/app/alerts', label: 'Alerts', icon: Bell, badge: alerts.length > 0 ? alerts.length : null },
    { to: '/app/profile', label: 'Profile', icon: User }
  ];

  return (
    <>
      <CustomerAppEntrySplash />
      <div className="w-full h-[100dvh] max-h-[100dvh] flex flex-col bg-slate-50 text-slate-900 overflow-hidden relative select-none">
      
      {/* Brand Top Header: AbsTracker (no space) */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-30 pt-safe shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
            <img src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" alt="Logo" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <div className="flex items-center gap-0 leading-none font-black text-sm tracking-tight font-sans">
              <span className="text-slate-900">Abs</span>
              <span className="text-red-600">Tracker</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-slate-500 font-normal block leading-tight tracking-normal mt-0.5 font-sans">
              Unconditional Aftersales Service
            </span>
          </div>
        </div>

        {/* Customer Status & Sound Toggle */}
        <div className="flex items-center gap-2">
          

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 size={15} className="text-blue-600" /> : <VolumeX size={15} className="text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Main Content Viewport: Explicit absolute/min-h-0 container */}
      <main className="flex-1 relative w-full h-full min-h-0 overflow-hidden bg-slate-50">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="h-16 bg-white border-t border-slate-200 px-2 flex items-center justify-around shrink-0 z-30 pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition-all relative select-none ${
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
    </div>
    </>
  );
}
