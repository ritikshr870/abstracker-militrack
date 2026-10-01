import React, { useState } from 'react';
import { api } from '../api/client';
import { Power, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { VehicleCategoryIcon } from './VehicleIcons';

export default function EngineControlModal({ vehicle, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!vehicle) return null;

  const isEngineOn = vehicle.ignition === true || vehicle.status === 'running';
  const targetAction = isEngineOn ? 'stop' : 'resume';

  const handleExecute = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.post('/api/commands/send', {
        deviceId: vehicle.id,
        type: targetAction === 'stop' ? 'engineStop' : 'engineResume',
        attributes: {
          data: targetAction === 'stop' ? 'RELAY,1#' : 'RELAY,0#'
        }
      });

      setSuccessMsg(targetAction === 'stop' ? 'Engine Turned Off' : 'Engine Turned On');
      if (onSuccess) onSuccess(targetAction);
      setTimeout(() => {
        onClose();
      }, 1300);
    } catch (err) {
      setError('Unable to reach vehicle. Please make sure vehicle is in network coverage.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              targetAction === 'stop' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <Power size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {targetAction === 'stop' ? 'Turn Off Engine?' : 'Turn On Engine?'}
              </h3>
              <p className="text-xs font-bold text-slate-700">
                {vehicle.name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        {/* Vehicle Summary Box with pure white avatar */}
        <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
          <div className="w-12 h-11 shrink-0">
            <VehicleCategoryIcon category={vehicle.category} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 truncate">{vehicle.name}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                isEngineOn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {isEngineOn ? 'Engine ON' : 'Engine OFF'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Speed: {vehicle.speed} km/h • Battery: {vehicle.battery}%</p>
          </div>
        </div>

        {/* Single Clear Friendly Warning */}
        {targetAction === 'stop' ? (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertTriangle size={18} className="shrink-0 text-red-600 mt-0.5" />
            <p className="text-[11px] leading-relaxed font-semibold">
              Warning: This will safely turn off the vehicle engine once it comes to a stop. Are you sure you want to stop the engine?
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-700">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
            <p className="text-[11px] leading-relaxed font-semibold">
              This will restore engine power, allowing the driver to crank and start the vehicle. Are you sure you want to turn on the engine?
            </p>
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-red-100 border border-red-200 rounded-2xl text-xs text-red-700 font-bold text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-bold text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            Cancel
          </button>

          <button
            onClick={handleExecute}
            disabled={loading}
            className={`flex-1 py-3 rounded-2xl text-xs font-black text-white transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 cursor-pointer ${
              targetAction === 'stop'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/25'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
            }`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            <span>{loading ? 'Please wait...' : (targetAction === 'stop' ? 'Turn Off Engine' : 'Turn On Engine')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
