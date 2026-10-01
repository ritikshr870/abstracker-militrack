import React, { useState } from 'react';
import { Share2, Clock, Copy, Check, MessageSquare, ExternalLink, X, ShieldCheck } from 'lucide-react';

const VALIDITY_OPTIONS = [
  { key: '1h', label: '1 Hour', hours: 1, ms: 1 * 60 * 60 * 1000 },
  { key: '6h', label: '6 Hours', hours: 6, ms: 6 * 60 * 60 * 1000 },
  { key: '24h', label: '24 Hours (1 Day)', hours: 24, ms: 24 * 60 * 60 * 1000, recommended: true },
  { key: '3d', label: '3 Days', hours: 72, ms: 3 * 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 Days', hours: 168, ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'never', label: 'Permanent (No Expiry)', hours: 0, ms: 0 }
];

export default function ShareLiveTrackingModal({ vehicle, onClose }) {
  const [selectedValidity, setSelectedValidity] = useState('24h');
  const [copied, setCopied] = useState(false);

  if (!vehicle) return null;

  const option = VALIDITY_OPTIONS.find(o => o.key === selectedValidity) || VALIDITY_OPTIONS[2];
  const expiryTimestamp = option.ms > 0 ? Date.now() + option.ms : 0;

  // Generate public tracking link with hash router
  const baseUrl = window.location.origin + window.location.pathname;
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const shareUrl = expiryTimestamp > 0
    ? `${cleanBase}/#/track/${vehicle.id}?exp=${expiryTimestamp}&name=${encodeURIComponent(vehicle.name)}`
    : `${cleanBase}/#/track/${vehicle.id}?name=${encodeURIComponent(vehicle.name)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleWhatsApp = () => {
    const statusText = (vehicle.status || 'Parked').toUpperCase();
    const speedText = vehicle.speed > 0 ? `${vehicle.speed} km/h` : 'Stopped';
    const validText = option.key === 'never' ? 'Always Active' : `Valid for ${option.label}`;
    
    const message = `📍 *AbsTracker Live Vehicle Tracking*\n\n` +
      `🚗 *Vehicle:* ${vehicle.name}\n` +
      `⚡ *Status:* ${statusText} (${speedText})\n` +
      `📌 *Location:* ${vehicle.address || 'GPS Live Point'}\n` +
      `⏳ *Link Validity:* ${validText}\n\n` +
      `👉 *Live Tracking Link:*\n${shareUrl}\n\n` +
      `_Powered by Abstracker Team_`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handlePreview = () => {
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn select-none font-sans">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slideUp">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Share Live Tracking
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {vehicle.name} <span className="text-slate-300">•</span> <span className="capitalize text-blue-600">{vehicle.status}</span>
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

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Validity Question */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600" />
              <span>Link kab tak valid rehna chaiye?</span>
            </label>
            <p className="text-[11px] text-slate-500">
              Is samay ke baad link automatically expire ho jayega aur location band ho jayegi.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {VALIDITY_OPTIONS.map((opt) => {
                const isSel = selectedValidity === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedValidity(opt.key)}
                    className={`py-2 px-3 rounded-2xl text-xs font-bold border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer relative ${
                      isSel
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/25 ring-2 ring-blue-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.recommended && (
                      <span className={`text-[9px] font-black uppercase tracking-wider ${isSel ? 'text-amber-200' : 'text-blue-600'}`}>
                        Default
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generated Link Preview */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-700">Shareable Web Link</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 pr-2.5">
              <input 
                type="text" 
                readOnly 
                value={shareUrl} 
                className="w-full bg-transparent text-xs text-slate-700 font-mono focus:outline-none select-all truncate px-1"
              />
              <button
                onClick={handleCopy}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Security Note */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-[11px] text-emerald-800">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No Account or Login Required for Viewer</p>
              <p className="text-emerald-700 mt-0.5 leading-snug">
                Anyone opening this link will see only <strong>{vehicle.name}</strong> live on the map without access to your other vehicles or account settings.
              </p>
            </div>
          </div>

          {/* Share Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleWhatsApp}
              className="py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/25 cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Share on WhatsApp</span>
            </button>

            <button
              onClick={handlePreview}
              className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-slate-900/20 cursor-pointer"
            >
              <ExternalLink size={15} />
              <span>Preview Link</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
