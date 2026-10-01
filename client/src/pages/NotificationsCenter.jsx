import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useFleet } from '../contexts/FleetContext';
import { 
  Bell, 
  ShieldAlert, 
  Zap, 
  Radio, 
  Power, 
  Key, 
  DoorOpen, 
  DoorClosed, 
  Gauge, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Send, 
  RefreshCw, 
  Smartphone, 
  Globe, 
  Mail, 
  MessageSquare,
  Volume2, 
  VolumeX, 
  Trash2, 
  CheckCheck,
  Compass,
  Filter,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';

const NOTIF_METADATA = {
  sos: {
    label: 'SOS Emergency Panic Alarm',
    desc: 'Driver triggered physical panic button inside cabin',
    icon: ShieldAlert,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    severity: 'critical'
  },
  powerCut: {
    label: 'Main Battery Wire Cut / Tamper',
    desc: 'Hardware power cable disconnected or battery tampering detected',
    icon: AlertTriangle,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    severity: 'critical'
  },
  powerRestored: {
    label: 'Main Battery Power Restored',
    desc: 'Device reconnected to vehicle electrical battery supply',
    icon: Zap,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    severity: 'info'
  },
  parking: {
    label: 'Unauthorized Parking Movement',
    desc: 'Vehicle moved while in locked parking security mode',
    icon: ShieldAlert,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
    severity: 'warning'
  },
  deviceOverspeed: {
    label: 'Overspeed Violation Alert',
    desc: 'Vehicle exceeded preset speed limit threshold on highway',
    icon: Gauge,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
    severity: 'warning'
  },
  geofenceEnter: {
    label: 'Geofence Safety Zone Entry',
    desc: 'Vehicle entered authorized geofence boundary',
    icon: MapPin,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    severity: 'info'
  },
  geofenceExit: {
    label: 'Geofence Zone Exit Alert',
    desc: 'Vehicle exited authorized perimeter / route boundary',
    icon: MapPin,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    severity: 'warning'
  },
  ignitionOn: {
    label: 'Ignition ON (Engine Started)',
    desc: 'Vehicle key turned ON and engine initiated',
    icon: Key,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    severity: 'info'
  },
  ignitionOff: {
    label: 'Ignition OFF (Engine Stopped)',
    desc: 'Vehicle key turned OFF and vehicle parked',
    icon: Power,
    color: 'text-slate-600 bg-slate-100 border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    severity: 'info'
  },
  deviceIdle: {
    label: 'Excessive Engine Idling',
    desc: 'Engine running stationary for prolonged duration',
    icon: ClockIcon,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    severity: 'warning'
  },
  deviceOverstay: {
    label: 'Excessive Stop Overstay',
    desc: 'Vehicle stationary beyond permissible trip stop limit',
    icon: AlertTriangle,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    severity: 'warning'
  },
  doorOpen: {
    label: 'Cabin Door Opened',
    desc: 'Door sensor triggered while in transit',
    icon: DoorOpen,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    severity: 'warning'
  },
  doorClosed: {
    label: 'Cabin Door Closed',
    desc: 'Vehicle doors securely latched',
    icon: DoorClosed,
    color: 'text-slate-600 bg-slate-100 border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    severity: 'info'
  },
  acOn: {
    label: 'Cabin Air Conditioner (AC) ON',
    desc: 'Cabin climate AC turned ON',
    icon: Zap,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    severity: 'info'
  },
  acOff: {
    label: 'Cabin Air Conditioner (AC) OFF',
    desc: 'Cabin climate AC turned OFF',
    icon: Zap,
    color: 'text-slate-600 bg-slate-100 border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    severity: 'info'
  },
  tollAreaEnter: {
    label: 'Toll Plaza Approach',
    desc: 'Vehicle approached highway toll collection zone',
    icon: MapPin,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    severity: 'info'
  },
  stateChanged: {
    label: 'Vehicle Status Transition',
    desc: 'Vehicle transitioned between moving, stopped, or offline',
    icon: Radio,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    severity: 'info'
  }
};

function ClockIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const { allDevices, socketConnected } = useFleet();
  const devices = allDevices || [];

  // Default active tab is now 'logs' (Live Telematics Stream)
  const [activeTab, setActiveTab] = useState('logs');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState('all');

  // Test Modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testType, setTestType] = useState('sos');
  const [testDevice, setTestDevice] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const audioContextRef = useRef(null);

  const playAlertSound = (isCritical = false) => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isCritical ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(isCritical ? 960 : 880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isCritical ? 480 : 440, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      if (Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch (e) {}
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/notifications/logs');
      if (Array.isArray(res.data?.logs)) {
        setLogs(res.data.logs);
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchLogs();
  }, []);

  // WebSocket Live Alert Receiver
  useEffect(() => {
    const handleWebSocketMessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'LIVE_ALERT' && msg.alert) {
          const alert = msg.alert;
          setLogs(prev => [alert, ...prev.slice(0, 150)]);
          const isCritical = alert.alarm === 'sos' || alert.alarm === 'powerCut' || alert.type === 'alarm';
          playAlertSound(isCritical);
          setFeedback({
            type: isCritical ? 'critical' : 'live',
            msg: `${alert.deviceName || 'Vehicle'}: ${alert.message || alert.type}`
          });
          setTimeout(() => setFeedback(null), 5000);
        }
      } catch (err) {}
    };

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/socketEvents`;
    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = handleWebSocketMessage;
    } catch (e) {}

    return () => {
      if (ws) ws.close();
    };
  }, [soundEnabled]);

  const toggleChannel = async (notif, channel) => {
    const channels = (notif.notificators || '').split(',').map(s => s.trim()).filter(Boolean);
    let updatedChannels = channels.includes(channel)
      ? channels.filter(c => c !== channel)
      : [...channels, channel];

    const newNotificators = updatedChannels.join(',');

    try {
      await axios.put(`/api/notifications/${notif.id}`, {
        ...notif,
        notificators: newNotificators
      });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, notificators: newNotificators } : n));
      setFeedback({ type: 'success', msg: `Updated push channels for ${getNotifMeta(notif).label}` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Failed to update channel setting.' });
    }
  };

  const handleSimulateAlert = async (presetType = null, customDevice = null) => {
    setTestLoading(true);
    const targetType = presetType || testType || 'sos';
    const dev = devices.find(d => String(d.id) === String(customDevice || testDevice)) || devices[0];
    const devName = dev ? (dev.name || dev.uniqueId) : 'BR01PS8108';

    const defaultMessages = {
      sos: 'EMERGENCY: SOS panic button triggered by driver!',
      powerCut: 'CRITICAL: Main vehicle battery power wire severed / tamper detected!',
      deviceOverspeed: 'VIOLATION: Vehicle speed recorded at 86 km/h (Limit: 60 km/h)',
      geofenceExit: 'BOUNDARY: Vehicle exited designated terminal zone (Patna Warehouse)',
      ignitionOn: 'OPERATIONAL: Vehicle ignition turned ON at bypass circle'
    };

    const msg = testMessage || defaultMessages[targetType] || `${devName}: Event ${targetType} triggered`;

    try {
      const res = await axios.post('/api/notifications/test', {
        type: targetType,
        deviceName: devName,
        message: msg,
        channel: 'firebase,web,sms'
      });

      if (res.data?.success) {
        setFeedback({ type: 'success', msg: `Test alert simulated for ${devName}!` });
        fetchLogs();
        setTestModalOpen(false);
        setTestMessage('');
      }
    } catch (e) {
      setFeedback({ type: 'error', msg: 'Failed to dispatch test notification.' });
    } finally {
      setTestLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const getNotifMeta = (item) => {
    const key = item.alarm || item.attributes?.alarms || item.type;
    return NOTIF_METADATA[key] || {
      label: String(key || 'General Alert').replace(/([A-Z])/g, ' $1').trim(),
      desc: 'Telematics fleet event',
      icon: Bell,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      severity: 'info'
    };
  };

  // Severity Counters
  const criticalLogs = logs.filter(l => {
    const m = getNotifMeta(l);
    return m.severity === 'critical';
  });

  const warningLogs = logs.filter(l => {
    const m = getNotifMeta(l);
    return m.severity === 'warning';
  });

  const filteredLogs = logs.filter(log => {
    const meta = getNotifMeta(log);
    const term = searchQuery.toLowerCase();
    const matchesSearch = (
      (log.deviceName && log.deviceName.toLowerCase().includes(term)) ||
      (log.message && log.message.toLowerCase().includes(term)) ||
      (meta.label && meta.label.toLowerCase().includes(term))
    );
    const matchesSeverity = filterSeverity === 'all' || meta.severity === filterSeverity;
    const matchesDevice = selectedDeviceFilter === 'all' || String(log.deviceId) === String(selectedDeviceFilter) || log.deviceName === selectedDeviceFilter;
    return matchesSearch && matchesSeverity && matchesDevice;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Alerts & Incident Center</h1>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                socketConnected 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {socketConnected ? 'Live Telematics Stream Active' : 'Connecting Stream'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Real-time hardware alarms, driver emergencies, speed violations, and push delivery rules
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              soundEnabled ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={soundEnabled ? 'Alert chime sound is enabled' : 'Alert chime is muted'}
          >
            {soundEnabled ? <Volume2 size={15} className="text-blue-600" /> : <VolumeX size={15} />}
            <span>{soundEnabled ? 'Siren Sound ON' : 'Muted'}</span>
          </button>

          <button
            onClick={() => {
              setTestType('sos');
              setTestDevice(devices[0]?.id || '');
              setTestModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <Send size={14} />
            <span>Simulate Live Alarm</span>
          </button>

          <button
            onClick={() => { fetchNotifications(); fetchLogs(); }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Refresh Alert Stream"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Floating Feedback Notification */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between animate-fade-in ${
          feedback.type === 'critical'
            ? 'bg-rose-600 text-white border-rose-700 shadow-lg animate-bounce'
            : (feedback.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200')
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'critical' ? <ShieldAlert size={18} /> : <CheckCheck size={16} className="text-emerald-600" />}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Metrics KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Incidents</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">{logs.length}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Radio size={16} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Critical Alarms</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-rose-600 font-mono">{criticalLogs.length}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              SOS / Wire Cut
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Speed & Geofence</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-amber-600 font-mono">{warningLogs.length}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
              Warnings
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Dispatch Channels</span>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Firebase</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Web</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">SMS</span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'logs' ? 'bg-slate-900 text-white shadow-sm font-black' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Radio size={14} className={logs.length > 0 ? 'text-emerald-400 animate-pulse' : ''} />
            <span>Live Incident Stream ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'rules' ? 'bg-slate-900 text-white shadow-sm font-black' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell size={14} />
            <span>Push Dispatch Rules ({notifications.length})</span>
          </button>
        </div>

        {activeTab === 'logs' && (
          <button
            onClick={() => setLogs([])}
            className="text-xs font-bold text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
          >
            <Trash2 size={13} />
            <span>Clear Stream</span>
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: LIVE INCIDENT STREAM & TELEMATICS FEED (PRIMARY) */}
      {/* =================================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          
          {/* Quick Simulation Presets Banner */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span className="text-xs font-black text-slate-900">Instant Telematics Simulation Triggers</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Test real-time siren sound & web notifications</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                onClick={() => handleSimulateAlert('sos')}
                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-left transition flex items-center gap-2"
              >
                <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                <div className="truncate">
                  <strong className="text-[11px] font-black block leading-tight">SOS Panic</strong>
                  <span className="text-[9px] text-rose-600">Critical Siren</span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateAlert('powerCut')}
                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-left transition flex items-center gap-2"
              >
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                <div className="truncate">
                  <strong className="text-[11px] font-black block leading-tight">Battery Wire Cut</strong>
                  <span className="text-[9px] text-red-600">Tamper Alert</span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateAlert('deviceOverspeed')}
                className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-left transition flex items-center gap-2"
              >
                <Gauge size={16} className="text-amber-600 shrink-0" />
                <div className="truncate">
                  <strong className="text-[11px] font-black block leading-tight">Overspeed 85 km/h</strong>
                  <span className="text-[9px] text-amber-700">Safety Violation</span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateAlert('geofenceExit')}
                className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-left transition flex items-center gap-2"
              >
                <MapPin size={16} className="text-indigo-600 shrink-0" />
                <div className="truncate">
                  <strong className="text-[11px] font-black block leading-tight">Geofence Exit</strong>
                  <span className="text-[9px] text-indigo-700">Perimeter Breach</span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateAlert('ignitionOn')}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-left transition flex items-center gap-2"
              >
                <Key size={16} className="text-emerald-600 shrink-0" />
                <div className="truncate">
                  <strong className="text-[11px] font-black block leading-tight">Ignition ON</strong>
                  <span className="text-[9px] text-emerald-700">Engine Started</span>
                </div>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search incident, vehicle plate, or alarm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="text-xs form-input py-1.5 px-3 bg-white border-slate-200 rounded-xl font-bold text-slate-700"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Only (SOS / Tamper)</option>
                <option value="warning">Warnings Only (Speed / Door)</option>
                <option value="info">Operational Events</option>
              </select>

              <select
                value={selectedDeviceFilter}
                onChange={(e) => setSelectedDeviceFilter(e.target.value)}
                className="text-xs form-input py-1.5 px-3 bg-white border-slate-200 rounded-xl font-bold text-slate-700"
              >
                <option value="all">All Vehicles</option>
                {devices.map(d => (
                  <option key={d.id} value={d.name || d.uniqueId}>
                    {d.name || d.uniqueId}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Incident Stream List */}
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
              <Radio size={36} className="mx-auto text-slate-300 mb-2 animate-pulse" />
              <p className="font-black text-slate-700 text-sm">No recent alarms logged in current session</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                Live alerts from GPS trackers and simulated events will stream into this feed in real-time. Use the Quick Presets above to trigger a test alarm.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const meta = getNotifMeta(log);
                const Icon = meta.icon;
                const isCritical = meta.severity === 'critical';
                const isWarning = meta.severity === 'warning';

                return (
                  <div
                    key={log.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden ${
                      isCritical ? 'border-rose-300 ring-1 ring-rose-200' : (isWarning ? 'border-amber-300' : 'border-slate-200')
                    }`}
                  >
                    {/* Left Severity Strip */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                      isCritical ? 'bg-rose-500' : (isWarning ? 'bg-amber-500' : 'bg-blue-500')
                    }`} />

                    {/* Event Details */}
                    <div className="flex items-start gap-3 pl-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-black text-slate-900">
                            {meta.label}
                          </strong>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono border ${meta.badgeColor}`}>
                            {meta.severity}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono">
                            {log.deviceName || 'Vehicle'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1 font-medium leading-snug">
                          {log.message}
                        </p>

                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                          <span>Delivered to: <strong className="text-slate-600">{log.channel || 'Firebase, Web Push'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Time & Action Tools */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <span className="text-xs font-mono font-black text-slate-900">
                        {log.formattedTime || (log.eventTime ? new Date(log.eventTime).toLocaleTimeString('en-IN') : 'Just now')}
                      </span>
                      <button
                        onClick={() => navigate('/')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <Compass size={11} />
                        <span>Locate on Map</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: ALERT RULES & CHANNELS CONFIGURATION */}
      {/* =================================================================== */}
      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notifications.map((notif) => {
            const meta = getNotifMeta(notif);
            const Icon = meta.icon;
            const channels = (notif.notificators || '').split(',').map(s => s.trim()).filter(Boolean);

            return (
              <div
                key={notif.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  meta.severity === 'critical' ? 'bg-rose-500' : (meta.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500')
                }`} />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${meta.color}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-900 leading-tight">{meta.label}</h3>
                        <span className="text-[10px] font-mono text-slate-400 block font-semibold mt-0.5">
                          Code: {notif.type}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono ${meta.badgeColor}`}>
                      {meta.severity}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mb-3.5 leading-snug">
                    {meta.desc}
                  </p>

                  {/* Channel Toggles */}
                  <div className="space-y-1.5 mb-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Active Push Channels
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['firebase', 'web', 'sms', 'mail'].map((ch) => (
                        <button
                          key={ch}
                          onClick={() => toggleChannel(notif, ch)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                            channels.includes(ch)
                              ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-2xs'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ch === 'firebase' && <Smartphone size={11} />}
                          {ch === 'web' && <Globe size={11} />}
                          {ch === 'sms' && <MessageSquare size={11} />}
                          {ch === 'mail' && <Mail size={11} />}
                          <span className="capitalize">{ch}</span>
                          {channels.includes(ch) && <CheckCircle2 size={11} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">Rule ID: #{notif.id}</span>
                  <button
                    onClick={() => handleSimulateAlert(notif.type)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition flex items-center gap-1"
                  >
                    <Send size={11} />
                    <span>Test Rule</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Test Alert Modal */}
      {testModalOpen && (
        <div className="modal-backdrop-fixed z-50 flex items-center justify-center p-4">
          <div className="modal-sheet-card max-w-md w-full bg-white rounded-2xl shadow-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Simulate Telematics Alert</h3>
                  <p className="text-[11px] text-slate-500">Dispatch live test event to connected browsers and phones</p>
                </div>
              </div>
              <button onClick={() => setTestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Alarm Event Type</label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  className="w-full form-input bg-white text-xs font-bold"
                >
                  <option value="sos">SOS Emergency Panic Alarm</option>
                  <option value="powerCut">Main Battery Wire Cut / Tamper</option>
                  <option value="deviceOverspeed">Overspeed Violation (85 km/h)</option>
                  <option value="geofenceExit">Geofence Perimeter Breach</option>
                  <option value="ignitionOn">Ignition ON (Engine Started)</option>
                  <option value="ignitionOff">Ignition OFF (Engine Stopped)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Target Vehicle</label>
                <select
                  value={testDevice}
                  onChange={(e) => setTestDevice(e.target.value)}
                  className="w-full form-input bg-white text-xs font-bold"
                >
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.uniqueId} ({d.model || 'Tracker'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Custom Message (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty for default message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full form-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  disabled={testLoading}
                  onClick={() => handleSimulateAlert()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  {testLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Fire Live Alarm</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}