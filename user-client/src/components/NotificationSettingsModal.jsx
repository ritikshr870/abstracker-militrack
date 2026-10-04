import React, { useState, useEffect } from 'react';
import { 
  X, Bell, BellRing, BellOff, Volume2, Key, Gauge, ShieldAlert, 
  Check, CheckCircle2, AlertTriangle, Sparkles, Send, RefreshCw, Mic 
} from 'lucide-react';
import { 
  getNotificationPermission, 
  checkNotificationPermissionAsync,
  requestNotificationPermission, 
  sendTestNotification,
  getStoredNotificationPrefs,
  saveNotificationPrefs,
  isNotificationSupported
} from '../utils/notificationManager';

export default function NotificationSettingsModal({ onClose }) {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [prefs, setPrefs] = useState(getStoredNotificationPrefs());
  const [testSent, setTestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const supported = isNotificationSupported();

  useEffect(() => {
    checkNotificationPermissionAsync().then(p => {
      if (p) setPermission(p);
    });
  }, []);

  const handleToggle = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotificationPrefs(updated);
  };

  const handleRequestPermission = async () => {
    setRequesting(true);
    setFeedback(null);
    try {
      const res = await requestNotificationPermission();
      setPermission(res);
      if (res === 'granted') {
        setFeedback({ type: 'success', text: 'Push notifications successfully enabled!' });
      } else if (res === 'denied') {
        setFeedback({ type: 'error', text: 'Notifications were blocked. Please enable them in app/device settings.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Permission request failed' });
    } finally {
      setRequesting(false);
    }
  };

  const handleSendTest = async () => {
    setTestSent(true);
    setFeedback(null);
    try {
      await sendTestNotification();
      setFeedback({ type: 'success', text: 'Test alert sent! Check your phone notification tray.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Could not dispatch test notification.' });
    } finally {
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <BellRing size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Push Notification Alerts
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Real-time security &amp; telemetry alerts
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Permission Status Banner */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            permission === 'granted'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : (permission === 'denied'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900')
          }`}>
            <div className="mt-0.5 shrink-0">
              {permission === 'granted' ? (
                <CheckCircle2 size={20} className="text-emerald-600" />
              ) : (permission === 'denied' ? (
                <BellOff size={20} className="text-rose-600" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600" />
              ))}
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs uppercase tracking-wider">
                  Permission Status: {permission.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {permission === 'granted'
                  ? 'Push notifications are active. You will receive real-time phone alerts for all critical vehicle events even when screen is locked.'
                  : (permission === 'denied'
                      ? 'Notifications are blocked in browser settings. Please click the padlock or site settings icon in your address bar and toggle Notifications to Allow.'
                      : 'Permission is needed so you can receive instant phone alerts for vehicle movement and ignition.')}
              </p>

              {permission !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  disabled={requesting}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {requesting ? <RefreshCw size={13} className="animate-spin" /> : <BellRing size={13} />}
                  <span>Enable Push Notifications</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {feedback.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Toggle Switches */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Alert Preferences
            </span>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              
              {/* Push Notifications Toggle */}
              <label className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition">
                <div className="flex items-center gap-2.5">
                  <Bell size={16} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Device Push Alerts</p>
                    <p className="text-[10px] text-slate-500">Send system banner alerts to mobile &amp; desktop</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.pushEnabled}
                  onChange={() => handleToggle('pushEnabled')}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              </label>

              {/* Audio Chime Toggle */}
              <label className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition">
                <div className="flex items-center gap-2.5">
                  <Volume2 size={16} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Sound &amp; Chime Alerts</p>
                    <p className="text-[10px] text-slate-500">Play alarm sound when new event occurs</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.soundEnabled}
                  onChange={() => handleToggle('soundEnabled')}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              </label>

              {/* Ignition Alerts */}
              <label className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition">
                <div className="flex items-center gap-2.5">
                  <Key size={16} className="text-amber-500 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Ignition ON / OFF Alarms</p>
                    <p className="text-[10px] text-slate-500">Notify whenever key ignition state changes</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.ignitionAlerts}
                  onChange={() => handleToggle('ignitionAlerts')}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              </label>

              {/* Overspeed Alerts */}
              <label className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition">
                <div className="flex items-center gap-2.5">
                  <Gauge size={16} className="text-red-500 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Overspeed Limit Alarms</p>
                    <p className="text-[10px] text-slate-500">Instant notification when speed threshold exceeded</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.overspeedAlerts}
                  onChange={() => handleToggle('overspeedAlerts')}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              </label>

              {/* Voice Speech Alert ("Engine On / Off") */}
              <label className="p-3 sm:p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition">
                <div className="flex items-center gap-2.5">
                  <Mic size={16} className="text-purple-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-xs">Spoken Voice Alerts ("Engine On / Off")</p>
                    <p className="text-[10px] text-slate-500">Real-time voice announcement for vehicle ignition &amp; alarms</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.voiceAlerts !== false}
                  onChange={() => handleToggle('voiceAlerts')}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                />
              </label>

            </div>
          </div>

          {/* Test Alert Button */}
          <button
            onClick={handleSendTest}
            disabled={testSent}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs transition flex items-center justify-center gap-2 shadow-md shadow-slate-900/20 cursor-pointer"
          >
            <Send size={14} className={testSent ? 'animate-pulse text-blue-400' : ''} />
            <span>Send Test Alert to This Device</span>
          </button>

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
          <span>AbsTracker Zero-Delay Push Hub</span>
          <button 
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
