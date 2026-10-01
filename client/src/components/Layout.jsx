import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '../contexts/AuthContext';
import { useFleet } from '../contexts/FleetContext';
import NotificationsPopover from './NotificationsPopover';
import axios from 'axios';
import { 
  Compass, 
  BellRing, 
  MapPin, 
  Truck, 
  UserCheck, 
  Wrench, 
  FolderTree, 
  LineChart, 
  Users, 
  Coins, 
  Smartphone, 
  Menu, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  RefreshCw, 
  X, 
  Radio, 
  Server,
  Layers,
  ShieldAlert,
  ExternalLink
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { socketConnected, allDevices } = useFleet();
  const location = useLocation();

  // Sidebar collapse state (persisted in localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('abstracker_sidebar_collapsed') === 'true';
  });

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);

  const exactDevicePoints = user?.devicePoints !== undefined ? user.devicePoints : 0;

  useEffect(() => {
    localStorage.setItem('abstracker_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Fetch recent alerts count
  useEffect(() => {
    const fetchAlertCount = () => {
      axios.get('/api/notifications/logs')
        .then(res => {
          if (Array.isArray(res.data?.logs)) {
            setUnreadAlertCount(Math.min(99, res.data.logs.length));
          }
        })
        .catch(() => {});
    };

    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 15000);
    return () => clearInterval(interval);
  }, []);

  // Listen to live socket events for live notification pulse
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/socketEvents`;
    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'LIVE_ALERT') {
            setUnreadAlertCount(prev => Math.min(99, prev + 1));
          }
        } catch (err) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Categorized Menu Structure
  const menuCategories = [
    {
      category: 'LIVE MONITORING',
      items: [
        { 
          path: '/', 
          label: 'Live Dashboard', 
          desc: 'Real-time tracking & vector map',
          icon: <Compass size={18} />, 
          badge: 'Live' 
        },
        { 
          path: '/notifications', 
          label: 'Alerts & Incidents', 
          desc: 'Live alarms & push rules',
          icon: <BellRing size={18} />, 
          badge: unreadAlertCount > 0 ? `${unreadAlertCount}` : null,
          badgeColor: 'bg-rose-500 text-white animate-pulse'
        },
        { 
          path: '/geofences', 
          label: 'Geofences & Zones', 
          desc: 'Perimeters & speed limits',
          icon: <MapPin size={18} /> 
        },
      ]
    },
    {
      category: 'FLEET ASSETS',
      items: [
        { 
          path: '/devices', 
          label: 'Devices Manager', 
          desc: 'Hardware trackers & IMEI',
          icon: <Truck size={18} />, 
          badge: allDevices.length > 0 ? `${allDevices.length}` : null,
          badgeColor: 'bg-blue-600 text-white'
        },
        { 
          path: '/drivers', 
          label: 'Drivers Directory', 
          desc: 'RFID codes & contacts',
          icon: <UserCheck size={18} /> 
        },
        { 
          path: '/maintenance', 
          label: 'Maintenance Hub', 
          desc: 'Service triggers & health',
          icon: <Wrench size={18} /> 
        },
        { 
          path: '/groups', 
          label: 'Groups & Divisions', 
          desc: 'Fleet hierarchy & depots',
          icon: <FolderTree size={18} /> 
        },
      ]
    },
    {
      category: 'MANAGEMENT & BILLING',
      items: [
        { 
          path: '/reports', 
          label: 'Reports Hub', 
          desc: 'Path, trips & audit logs',
          icon: <LineChart size={18} /> 
        },
        { 
          path: '/users', 
          label: 'Users Directory', 
          desc: 'Client accounts & access',
          icon: <Users size={18} /> 
        },
        { 
          path: '/system', 
          label: 'Ports & Device Coins', 
          desc: 'Coins recharge & gateway ports',
          icon: <Coins size={18} />, 
          badge: `${exactDevicePoints} COINS`,
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
        },
      ]
    },
    {
      category: 'MOBILE PLATFORM',
      items: [
        { 
          path: '/app', 
          label: 'Customer Mobile App', 
          desc: 'Switch to client tracking view',
          icon: <Smartphone size={18} />,
          badge: 'Preview',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        }
      ]
    }
  ];

  // Helper to get active page title
  const getActiveTitle = () => {
    for (const cat of menuCategories) {
      for (const item of cat.items) {
        if (item.path === location.pathname) {
          return { label: item.label, icon: item.icon, desc: item.desc };
        }
      }
    }
    return { label: 'Admin Fleet Operations', icon: <Compass size={18} />, desc: 'Fleet Operations' };
  };

  const activePage = getActiveTitle();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900">
      
      {/* ------------------------------------------------------------------- */}
      {/* 1. DESKTOP & LAPTOP SIDEBAR NAVIGATION MENU */}
      {/* ------------------------------------------------------------------- */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 transition-all duration-300 z-40 relative ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700 shadow-md flex-shrink-0 bg-slate-950 flex items-center justify-center">
              <img src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" alt="ABSTRACKER" className="w-full h-full object-cover" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black tracking-wider text-white">ABSTRACKER</span>
                  <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                </div>
                <p className="text-[10px] text-slate-400 font-medium italic tracking-tight truncate">
                  Unconditional Aftersales
                </p>
              </div>
            )}
          </div>

          {/* Toggle Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-sm"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Scrollable Navigation Menu List */}
        <div className="flex-1 overflow-y-auto custom-scroll py-3 px-2.5 space-y-4">
          {menuCategories.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-1">
              {!collapsed ? (
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 px-3 block mb-1">
                  {cat.category}
                </span>
              ) : (
                <div className="h-px bg-slate-800 my-2 mx-1" />
              )}

              {cat.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? `${item.label} (${item.desc})` : ''}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 px-3 py-2 rounded-xl transition font-bold text-xs relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md font-black'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    } ${collapsed ? 'justify-center' : 'justify-between'}`
                  }
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!collapsed && item.badge && (
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                      item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {collapsed && item.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Sidebar Footer User & Coins Card */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
          {!collapsed ? (
            <div className="space-y-2.5">
              <NavLink
                to="/system"
                className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition text-amber-300"
                title="Manage Device Coins"
              >
                <div className="flex items-center gap-2">
                  <Coins size={16} className="text-amber-400" />
                  <span className="text-[11px] font-bold">Device Coins:</span>
                </div>
                <strong className="text-xs font-mono font-black text-amber-200">
                  {exactDevicePoints} COINS
                </strong>
              </NavLink>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AB'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate leading-none">{user?.name || user?.username || 'ABS Tracker'}</p>
                    <p className="text-[10px] font-mono text-slate-400 font-bold leading-tight mt-1">ID: #{user?.id || 29350}</p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
                  title="Logout session"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <NavLink
                to="/system"
                className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:bg-amber-500/20 transition"
                title={`${exactDevicePoints} Device Coins`}
              >
                <Coins size={16} />
              </NavLink>
              <button
                onClick={logout}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-rose-900/40 flex items-center justify-center text-slate-400 hover:text-rose-400 transition"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------- */}
      {/* 2. MOBILE / TABLET SLIDE-OVER DRAWER NAVIGATION */}
      {/* ------------------------------------------------------------------- */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Slide-out Panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-200 shadow-2xl z-50">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
                  <img src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">ABSTRACKER</h2>
                  <p className="text-[10px] text-slate-400 font-medium italic">Unconditional Aftersales</p>
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {menuCategories.map((cat, catIdx) => (
                <div key={catIdx} className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 px-3 block mb-1">
                    {cat.category}
                  </span>
                  {cat.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition ${
                          isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-200">{exactDevicePoints} COINS</span>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 3. MAIN WORKSPACE CONTAINER */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 shadow-xs">
          
          {/* Left: Hamburger & Active Page Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileDrawerOpen(true);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center"
              title="Toggle Menu"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                {activePage.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                    {activePage.label}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {socketConnected ? 'Live' : 'Connecting'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden md:block leading-none mt-0.5">
                  ABSTRACKER Enterprise Telematics <span className="text-slate-300 mx-1">•</span> <span className="text-slate-700 font-bold">Abstracker Team</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right: Quick Tools, Device Coins, Alerts Bell, Logout */}
          <div className="flex items-center gap-2.5">
            
            {/* Live Device Coins Wallet Pill */}
            <NavLink
              to="/system"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-950 transition cursor-pointer shadow-xs"
              title="Available Device Coins Balance"
            >
              <Coins size={15} className="text-amber-500" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 leading-none">Device Coins</span>
                <strong className="text-xs font-mono font-black text-amber-950 leading-none mt-0.5">
                  {exactDevicePoints} <span className="text-[10px] font-sans font-semibold text-amber-700">COINS</span>
                </strong>
              </div>
            </NavLink>

            {/* Notifications Alert Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(prev => !prev)}
                className={`p-2 rounded-xl text-xs transition flex items-center justify-center font-bold border relative ${
                  showNotifications ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Notifications & Telematics Alarms"
              >
                <BellRing size={15} />
                {unreadAlertCount > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white animate-pulse" />
                )}
              </button>

              <NotificationsPopover
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
              />
            </div>

            {/* Refresh Fleet Data */}
            <button
              onClick={() => window.location.reload()}
              title="Reload data"
              className="p-2 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center font-bold border border-slate-200"
            >
              <RefreshCw size={14} />
            </button>

            {/* Quick Switch to Customer Mobile App View */}
            <NavLink
              to="/app"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition"
              title="Open Customer Mobile Tracking App"
            >
              <Smartphone size={14} />
              <span>Customer App</span>
            </NavLink>

            {/* Logout */}
            <button
              onClick={logout}
              title="Log out"
              className="p-2 rounded-xl text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition flex items-center justify-center font-bold"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 flex overflow-hidden relative bg-slate-100">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

      </div>
    </div>
  );
}
