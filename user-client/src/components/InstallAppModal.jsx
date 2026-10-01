import React, { useState } from 'react';
import { 
  X, Download, Smartphone, Apple, Globe, ShieldCheck, 
  CheckCircle, ArrowDownCircle, Share2, PlusSquare, Sparkles, ExternalLink 
} from 'lucide-react';

export default function InstallAppModal({ onClose, deferredPrompt, onInstallSuccess }) {
  const [activeTab, setActiveTab] = useState('android'); // 'android' | 'pwa' | 'ios'
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleDownloadApk = () => {
    setDownloadStarted(true);
    // Direct link to download the Android APK package
    const link = document.createElement('a');
    link.href = '/downloads/abstracker.apk';
    link.download = 'AbsTracker_GPS_Tracking_v4.5.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setDownloadStarted(false), 4000);
  };

  const handlePwaInstall = async () => {
    if (!deferredPrompt) {
      alert('To install the web app, tap your browser menu (three dots ⋮) and select "Add to Home Screen" or "Install App".');
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        if (onInstallSuccess) onInstallSuccess();
        if (onClose) onClose();
      }
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp max-h-[92dvh]">
        
        {/* Header with AbsTracker Brand */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shadow-md shadow-blue-600/10 shrink-0">
              <img 
                src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" 
                alt="Logo" 
                className="w-full h-full object-cover rounded-xl" 
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Install AbsTracker App
                </h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded-full border border-emerald-200">
                  v4.5 Official
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Choose your preferred installation method
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

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'android'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Smartphone size={15} />
            <span>Android APK</span>
          </button>

          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Sparkles size={15} />
            <span>Instant Web App</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Apple size={15} />
            <span>iPhone / iOS</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto custom-scroll space-y-4 text-xs">
          
          {/* TAB 1: ANDROID APK DIRECT DOWNLOAD */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-emerald-50/60 to-blue-50/60 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Smartphone size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                    Direct Android Package (.APK)
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Download and install the official standalone Android application for background GPS push alerts and fast vehicle monitoring.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-bold text-slate-500">
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md">Android 7.0+</span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md">Size: ~14.8 MB</span>
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-emerald-700 flex items-center gap-1">
                      <ShieldCheck size={11} /> Verified Safe
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct APK Download Button */}
              <button
                onClick={handleDownloadApk}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                {downloadStarted ? (
                  <>
                    <CheckCircle size={18} className="animate-bounce" />
                    <span>Downloading APK Package...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>Download Android APK (v4.5)</span>
                  </>
                )}
              </button>

              {/* Step-by-Step Installation Guide */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <h5 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownCircle size={14} className="text-emerald-600" />
                  <span>How to Install APK:</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 font-medium leading-relaxed">
                  <li>Tap the <strong>Download Android APK</strong> button above.</li>
                  <li>When downloaded, open the file from your phone's Notification Bar or <strong>Downloads</strong> folder.</li>
                  <li>If prompted with <em>"Install unknown apps"</em>, toggle <strong>Allow from this source</strong>.</li>
                  <li>Tap <strong>Install</strong> to complete setup and open AbsTracker.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: INSTANT WEB APP (PWA) */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                    Zero Storage Web App (PWA)
                  </h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Adds AbsTracker directly to your device home screen without downloading a separate file. Instant updates, zero storage usage, and offline shell.
                  </p>
                </div>
              </div>

              {/* Install PWA Button */}
              <button
                onClick={handlePwaInstall}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-2xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <PlusSquare size={18} />
                <span>Add AbsTracker to Home Screen</span>
              </button>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-[11px] text-slate-600">
                <p className="font-bold text-slate-800">Supported Browsers:</p>
                <div className="flex items-center gap-4 text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5"><Globe size={14} className="text-blue-600" /> Google Chrome</span>
                  <span>Edge</span>
                  <span>Samsung Internet</span>
                  <span>Brave</span>
                </div>
                <p className="text-[10px] text-slate-400 pt-1">
                  If the prompt does not open automatically, tap your browser's menu (⋮) and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: APPLE IPHONE / IOS GUIDE */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 shadow-md">
                <div className="flex items-center gap-2">
                  <Apple size={20} className="text-white" />
                  <h4 className="font-black text-sm">Install on iPhone &amp; iPad</h4>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Apple Safari allows installing AbsTracker directly to your iOS Home Screen with full native fullscreen view and push notification support.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div className="text-[11px]">
                    <p className="font-bold text-slate-800">Tap the Share Button</p>
                    <p className="text-slate-500 mt-0.5">
                      Tap the <Share2 size={13} className="inline text-blue-600 mx-0.5" /> <strong>Share</strong> icon in the bottom menu bar of Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div className="text-[11px]">
                    <p className="font-bold text-slate-800">Select "Add to Home Screen"</p>
                    <p className="text-slate-500 mt-0.5">
                      Scroll down in the action sheet and tap <PlusSquare size={13} className="inline text-blue-600 mx-0.5" /> <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div className="text-[11px]">
                    <p className="font-bold text-slate-800">Tap "Add" in Top Right</p>
                    <p className="text-slate-500 mt-0.5">
                      Confirm by tapping <strong>Add</strong>. AbsTracker icon will appear on your iPhone screen!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-semibold shrink-0">
          <span>AbsTracker Telematics Suite</span>
          <button 
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
