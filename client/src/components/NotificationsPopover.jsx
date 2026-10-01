import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { NavLink } from 'react-router-dom';
import { 
  Bell, ShieldAlert, Zap, Radio, Power, Key, DoorOpen, DoorClosed, 
  Gauge, MapPin, AlertTriangle, CheckCheck, X, Volume2, VolumeX, Trash2, ExternalLink
} from 'lucide-react';
import { useFleet } from '../contexts/FleetContext';

// Standard mapping for notification icons and severity styles
const NOTIF_ICONS = {
  ignitionOn: { icon: Key, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', title: 'Ignition ON', severity: 'info' },
  ignitionOff: { icon: Power, color: 'text-slate-600 bg-slate-100 border-slate-200', title: 'Ignition OFF', severity: 'info' },
  deviceOverspeed: { icon: Gauge, color: 'text-amber-600 bg-amber-50 border-amber-200', title: 'Overspeed Alert', severity: 'warning' },
  geofenceEnter: { icon: MapPin, color: 'text-blue-600 bg-blue-50 border-blue-200', title: 'Geofence Entry', severity: 'info' },
  geofenceExit: { icon: MapPin, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', title: 'Geofence Exit', severity: 'warning' },
  deviceIdle: { icon: ClockIcon, color: 'text-amber-600 bg-amber-50 border-amber-200', title: 'Engine Idling', severity: 'warning' },
  deviceOverstay: { icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-200', title: 'Overstay Alert', severity: 'warning' },
  doorOpen: { icon: DoorOpen, color: 'text-amber-600 bg-amber-50 border-amber-200', title: 'Door Opened', severity: 'warning' },
  doorClosed: { icon: DoorClosed, color: 'text-slate-600 bg-slate-100 border-slate-200', title: 'Door Closed', severity: 'info' },
  acOn: { icon: Zap, color: 'text-cyan-600 bg-cyan-50 border-cyan-200', title: 'AC Turned ON', severity: 'info' },
  acOff: { icon: Zap, color: 'text-slate-600 bg-slate-100 border-slate-200', title: 'AC Turned OFF', severity: 'info' },
  tollAreaEnter: { icon: MapPin, color: 'text-purple-600 bg-purple-50 border-purple-200', title: 'Toll Plaza Entry', severity: 'info' },
  stateChanged: { icon: Radio, color: 'text-blue-600 bg-blue-50 border-blue-200', title: 'State Changed', severity: 'info' },
  sos: { icon: ShieldAlert, color: 'text-rose-600 bg-rose-50 border-rose-200', title: 'SOS Panic Emergency', severity: 'critical' },
  powerCut: { icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-200', title: 'Battery Wire Cut / Tamper', severity: 'critical' },
  powerRestored: { icon: Zap, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', title: 'Main Power Restored', severity: 'info' },
  parking: { icon: ShieldAlert, color: 'text-amber-600 bg-amber-50 border-amber-200', title: 'Parking Movement Alert', severity: 'warning' },
  default: { icon: Bell, color: 'text-blue-600 bg-blue-50 border-blue-200', title: 'Device Notification', severity: 'info' }
};

function ClockIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

// Generate realistic default alert notifications from available devices
function generateInitialNotifications(devices = []) {
  const d1 = devices[0]?.name || 'BR01PS8108';
  const d2 = devices[1]?.name || 'BR01EV9871';
  const d3 = devices[2]?.name || 'BR02BW3841';

  return [
    {
      id: 1,
      type: 'ignitionOn',
      deviceName: d1,
      title: 'Ignition ON (Engine Started)',
      message: `${d1} vehicle key turned ON at Patna bypass`,
      time: 'Just now',
      unread: true,
      channels: 'Firebase, Web'
    },
    {
      id: 2,
      type: 'powerCut',
      deviceName: d2,
      title: 'Main Battery Cut / Tamper',
      message: `${d2} device power cable disconnected / wire tamper detected`,
      time: '14 mins ago',
      unread: true,
      channels: 'Firebase, Web, SMS'
    },
    {
      id: 3,
      type: 'deviceOverspeed',
      deviceName: d3,
      title: 'Overspeed Violation',
      message: `${d3} exceeded speed threshold (82 km/h on SH-18)`,
      time: '42 mins ago',
      unread: true,
      channels: 'Firebase, Web'
    },
    {
      id: 4,
      type: 'geofenceEnter',
      deviceName: d1,
      title: 'Geofence Zone Entry',
      message: `${d1} entered warehouse zone boundary`,
      time: '1 hr ago',
      unread: false,
      channels: 'Firebase, Web'
    },
    {
      id: 5,
      type: 'doorOpen',
      deviceName: d2,
      title: 'Cabin Door Opened',
      message: `${d2} cabin door opened unexpectedly`,
      time: '2 hrs ago',
      unread: false,
      channels: 'Firebase, Web'
    },
    {
      id: 6,
      type: 'ignitionOff',
      deviceName: d3,
      title: 'Ignition OFF (Engine Stopped)',
      message: `${d3} engine stopped and parked`,
      time: '3 hrs ago',
      unread: false,
      channels: 'Firebase'
    }
  ];
}

export default function NotificationsPopover({ isOpen, onClose }) {
  const { devices, socketConnected } = useFleet();
  const [notifications, setNotifications] = useState(() => generateInitialNotifications(devices));
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'alarms' | 'ignition'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const popoverRef = useRef(null);

  // Audio alert chime
  const audioContextRef = useRef(null);
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Load server logs and listen to live WebSocket alerts
  useEffect(() => {
    axios.get('/api/notifications/logs')
      .then(res => {
        if (Array.isArray(res.data?.logs) && res.data.logs.length > 0) {
          const serverItems = res.data.logs.map(log => ({
            id: log.id,
            type: log.alarm || log.type,
            deviceName: log.deviceName || 'Vehicle',
            title: log.alarm === 'sos' ? 'SOS Panic Emergency' : (log.alarm === 'powerCut' ? 'Battery Wire Cut' : log.type),
            message: log.message || `${log.deviceName} alert triggered`,
            time: log.formattedTime || 'Just now',
            unread: true,
            channels: log.channel || 'Firebase, Web'
          }));
          setNotifications(prev => {
            const combined = [...serverItems, ...prev];
            const seen = new Set();
            return combined.filter(item => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
          });
        }
      })
      .catch(() => {});

    // Listen to live WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/socketEvents`;
    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'LIVE_ALERT' && msg.alert) {
            const log = msg.alert;
            const newNotif = {
              id: log.id || Date.now(),
              type: log.alarm || log.type,
              deviceName: log.deviceName || 'Vehicle',
              title: log.alarm === 'sos' ? 'SOS Panic Emergency' : (log.alarm === 'powerCut' ? 'Battery Wire Cut' : log.type),
              message: log.message || `${log.deviceName} alert triggered`,
              time: 'Just now',
              unread: true,
              channels: log.channel || 'Firebase, Web'
            };
            setNotifications(prev => [newNotif, ...prev]);
            playChime();
          }
        } catch (err) {}
      };
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, [soundEnabled]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const filteredList = notifications.filter(n => {
    if (filterTab === 'alarms') {
      return ['sos', 'powerCut', 'deviceOverspeed', 'deviceOverstay', 'doorOpen', 'parking'].includes(n.type);
    }
    if (filterTab === 'ignition') {
      return ['ignitionOn', 'ignitionOff', 'deviceIdle'].includes(n.type);
    }
    return true;
  });

  return (
    <div 
      ref={popoverRef}
      className="absolute right-0 top-14 w-96 max-w-[92vw] sm:w-[400px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden flex flex-col max-h-[540px] animate-fade-in"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Bell size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 leading-none">Notifications</h3>
            <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
              {unreadCount > 0 ? `${unreadCount} new alerts` : 'All alerts caught up'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition px-2 py-1 rounded-lg hover:bg-blue-50 flex items-center gap-1"
              title="Mark all notifications as read"
            >
              <CheckCheck size={13} />
              <span>Mark Read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Quick Filter Tabs */}
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5 text-xs font-bold flex-shrink-0">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1 rounded-lg transition text-[11px] ${filterTab === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilterTab('alarms')}
          className={`px-3 py-1 rounded-lg transition text-[11px] ${filterTab === 'alarms' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
        >
          Alarms
        </button>
        <button
          onClick={() => setFilterTab('ignition')}
          className={`px-3 py-1 rounded-lg transition text-[11px] ${filterTab === 'ignition' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200/60'}`}
        >
          Ignition
        </button>
      </div>

      {/* Notification List */}
      <div className="overflow-y-auto flex-1 divide-y divide-slate-100 custom-scroll">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Bell size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-600">No notifications in this view</p>
            <p className="text-[11px] text-slate-400">Live tracker events will automatically appear here.</p>
          </div>
        ) : (
          filteredList.map((item) => {
            const meta = NOTIF_ICONS[item.type] || NOTIF_ICONS.default;
            const Icon = meta.icon;

            return (
              <div 
                key={item.id}
                onClick={() => setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, unread: false } : n))}
                className={`p-3.5 hover:bg-slate-50 transition flex items-start gap-3 cursor-pointer ${item.unread ? 'bg-blue-50/40' : ''}`}
              >
                {/* Icon Pill */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                  <Icon size={16} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-black text-slate-900 truncate">
                      {item.title || meta.title}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 font-medium">
                      {item.time}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 font-medium leading-snug mt-0.5 line-clamp-2">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-bold uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.deviceName}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      via {item.channels}
                    </span>
                  </div>
                </div>

                {/* Unread indicator */}
                {item.unread && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1 animate-pulse"></span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Link to Full Alerts Center */}
      <NavLink
        to="/notifications"
        onClick={onClose}
        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 border-t border-blue-100 flex items-center justify-between text-[11px] font-bold text-blue-700 transition"
      >
        <span>Open Alerts & Incident Center</span>
        <ExternalLink size={12} />
      </NavLink>

      {/* Footer Tools */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs flex-shrink-0">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center gap-1.5 font-bold text-[11px] transition ${soundEnabled ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400'}`}
          title={soundEnabled ? 'Alert chime is enabled' : 'Alert chime is muted'}
        >
          {soundEnabled ? <Volume2 size={13} className="text-blue-600" /> : <VolumeX size={13} />}
          <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Live Stream
          </span>
          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
