import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTracking } from '../contexts/TrackingContext';
import { 
  User, LogOut, ShieldCheck, PhoneCall, Sparkles, Car, CheckCircle, 
  Smartphone, Download, BellRing, Bell, Send 
} from 'lucide-react';
import InstallAppModal from '../components/InstallAppModal';
import NotificationSettingsModal from '../components/NotificationSettingsModal';
import { getNotificationPermission, sendTestNotification } from '../utils/notificationManager';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { stats } = useTracking();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [testRunning, setTestRunning] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleSendTest = async () => {
    setTestRunning(true);
    setTestFeedback(null);
    try {
      await sendTestNotification();
      setTestFeedback('Alert Sent!');
      setTimeout(() => setTestFeedback(null), 3000);
    } catch (err) {
      setTestFeedback(err.message || 'Error sending alert');
      setTimeout(() => setTestFeedback(null), 4000);
    } finally {
      setTestRunning(false);
      setPermission(getNotificationPermission());
    }
  };

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

        {/* Mobile Application & APK Download Section */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Smartphone size={16} className="text-blue-600" />
              <span>Mobile Application &amp; APK</span>
            </h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              v4.5 Release
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Install AbsTracker on your Android or iOS smartphone for instantaneous vehicle ignition and overspeed alerts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/downloads/abstracker.apk';
                link.download = 'AbsTracker_GPS_Tracking_v4.5.apk';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Download size={15} />
              <span>Download Android APK</span>
            </button>

            <button
              onClick={() => setShowInstallModal(true)}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
            >
              <Sparkles size={15} className="text-blue-600" />
              <span>Installation Instructions</span>
            </button>
          </div>
        </div>

        {/* Push Notifications & Alarm Center */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BellRing size={16} className="text-amber-500" />
              <span>Push Notification Alarms</span>
            </h3>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              permission === 'granted'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : (permission === 'denied'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200')
            }`}>
              {permission === 'granted' ? 'Active' : (permission === 'denied' ? 'Blocked' : 'Needs Setup')}
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Receive native push banners and acoustic chime alarms directly on your device when ignition switches on or speed thresholds are exceeded.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => setShowNotificationModal(true)}
              className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Bell size={15} />
              <span>Configure Notification Alerts</span>
            </button>

            <button
              onClick={handleSendTest}
              disabled={testRunning}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
            >
              <Send size={14} className={testRunning ? 'animate-pulse text-blue-600' : 'text-slate-500'} />
              <span>{testFeedback || 'Send Test Device Alert'}</span>
            </button>
          </div>
        </div>

        {/* Help & Support */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3.5 shadow-xs">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Customer Care &amp; Support</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="flex items-center gap-2.5 font-bold text-slate-700">
                <PhoneCall size={16} className="text-blue-600" /> 24/7 Technical Helpline
              </span>
              <span className="font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl">Active</span>
            </div>
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

      {/* Install App / APK Modal */}
      {showInstallModal && (
        <InstallAppModal onClose={() => setShowInstallModal(false)} />
      )}

      {/* Push Notification Settings Modal */}
      {showNotificationModal && (
        <NotificationSettingsModal 
          onClose={() => {
            setShowNotificationModal(false);
            setPermission(getNotificationPermission());
          }} 
        />
      )}
    </div>
  );
}
