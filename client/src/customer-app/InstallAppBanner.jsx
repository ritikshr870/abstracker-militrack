import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Check } from 'lucide-react';

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('abstracker_install_dismissed');
    if (dismissed) return;

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // On iOS Safari, show prompt banner after 2.5s
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    // On Android / Chrome / Edge
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      alert('To install: tap your browser menu (⋮) and choose "Add to Home screen" or "Install App".');
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } catch (err) {}
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('abstracker_install_dismissed', 'true');
  };

  if (isInstalled || !showBanner) return null;

  return (
    <>
      {/* Floating Modern PWA Install Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white px-3.5 py-2.5 shadow-lg border-b border-blue-500/40 flex items-center justify-between z-50 shrink-0 select-none animate-fadeIn">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-white p-1 shrink-0 shadow-md flex items-center justify-center">
            <img 
              src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" 
              alt="AbsTracker Logo" 
              className="w-full h-full object-cover rounded-xl" 
            />
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-xs text-white leading-tight flex items-center gap-1.5">
              <span>Install AbsTracker App</span>
              <span className="text-[9px] bg-white/20 text-white font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">Fast</span>
            </h4>
            <p className="text-[10px] text-blue-100 font-medium truncate">
              Full-screen live tracking on your home screen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-blue-700 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-black/10 transition cursor-pointer active:scale-95"
          >
            <Download size={13} className="stroke-[3]" />
            <span>Install</span>
          </button>

          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
            title="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* iOS Safari 2-step Add to Home Screen Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone size={20} className="text-blue-600" />
                <h3 className="font-black text-slate-900 text-sm">Install on iPhone / iPad</h3>
              </div>
              <button 
                onClick={() => setShowIosGuide(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="font-bold text-slate-800">Tap the Share Button</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tap the <Share size={13} className="inline text-blue-600 mx-0.5" /> icon at the bottom of Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="font-bold text-slate-800">Tap "Add to Home Screen"</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Scroll down and tap <PlusSquare size={13} className="inline text-slate-700 mx-0.5" /> <strong>Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl cursor-pointer"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
