import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';
import InstallAppModal from './InstallAppModal';

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is running as installed PWA or full standalone mode
    const standaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standaloneMode) {
      setIsStandalone(true);
      return;
    }

    const dismissed = sessionStorage.getItem('abstracker_install_banner_dismissed');
    if (dismissed) return;

    // Listen for Chrome/Edge beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // On mobile web, show install banner automatically after 3 seconds
    const timer = setTimeout(() => {
      if (!sessionStorage.getItem('abstracker_install_banner_dismissed')) {
        setShowBanner(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleDismiss = (e) => {
    e.stopPropagation();
    setShowBanner(false);
    sessionStorage.setItem('abstracker_install_banner_dismissed', 'true');
  };

  if (isStandalone || !showBanner) {
    return showModal ? (
      <InstallAppModal 
        deferredPrompt={deferredPrompt} 
        onClose={() => setShowModal(false)} 
        onInstallSuccess={() => setShowBanner(false)}
      />
    ) : null;
  }

  return (
    <>
      {/* Floating Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-3.5 py-2.5 shadow-md flex items-center justify-between shrink-0 select-none z-40 border-b border-white/10 animate-fadeIn">
        <div 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 mr-2"
        >
          <div className="w-8 h-8 rounded-xl bg-white p-0.5 shrink-0 shadow-sm flex items-center justify-center">
            <img 
              src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" 
              alt="Logo" 
              className="w-full h-full object-cover rounded-lg" 
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs text-white leading-tight">Install AbsTracker Mobile App</span>
              <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded-full font-bold">APK / Web</span>
            </div>
            <p className="text-[10px] text-blue-100 font-medium truncate mt-0.5">
              Download Android APK or add to home screen for instant alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white text-blue-600 hover:bg-blue-50 text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Download size={13} />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {showModal && (
        <InstallAppModal 
          deferredPrompt={deferredPrompt} 
          onClose={() => setShowModal(false)} 
          onInstallSuccess={() => setShowBanner(false)}
        />
      )}
    </>
  );
}
