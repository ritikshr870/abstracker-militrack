import React, { useState } from 'react';
import axios from 'axios';
import { Power, Loader2, CheckCircle2, AlertTriangle, X, ShieldAlert, Sparkles } from 'lucide-react';
import { VehicleCategoryIcon } from './CustomerVehicleIcons';

export default function EngineControlModal({ vehicle, onClose, onSuccess }) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!vehicle) return null;

  const isEngineRunning = vehicle.ignition === true || vehicle.status === 'running' || vehicle.speed > 2;

  const handleExecute = async (action) => {
    setLoadingAction(action);
    setError('');
    setSuccessMsg('');

    try {
      const templateId = action === 'stop' ? 1 : 2;
      const type = action === 'stop' ? 'engineStop' : 'engineResume';
      const relayData = action === 'stop' ? 'RELAY,1#' : 'RELAY,0#';

      const res = await axios.post('/api/commands/send', {
        id: templateId,
        deviceId: vehicle.id,
        type: type,
        attributes: {
          data: relayData
        }
      });

      if (res.data?.status === 'QUEUED') {
        setSuccessMsg('Command Queued: Relay command will execute as soon as vehicle connects.');
      } else {
        setSuccessMsg(action === 'stop' ? '✓ Engine Turned Off (Relay Cut Confirmed)' : '✓ Engine Turned On (Relay Restored Confirmed)');
      }

      if (onSuccess) onSuccess(action);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Unable to transmit command. Please ensure vehicle has cellular coverage.';
      setError(errMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
              <Power size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Engine Relay Control
              </h3>
              <p className="text-xs font-bold text-slate-700">
                {vehicle.name}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Vehicle Summary Box */}
        <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
          <div className="w-12 h-11 shrink-0">
            <VehicleCategoryIcon category={vehicle.category} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 truncate">{vehicle.name}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                isEngineRunning ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {isEngineRunning ? 'Engine Running' : 'Engine Off / Stopped'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Speed: {vehicle.speed} km/h • Battery: {vehicle.battery}%</p>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="p-2.5 bg-red-100 border border-red-200 rounded-2xl text-xs text-red-700 font-bold text-center">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-bold text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dual Actions: Both Stop and Resume explicitly provided */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => handleExecute('stop')}
            disabled={loadingAction !== null}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-red-600/25 cursor-pointer disabled:opacity-60"
          >
            {loadingAction === 'stop' ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            <span>Turn Off Engine (Cut Relay)</span>
          </button>

          <button
            onClick={() => handleExecute('resume')}
            disabled={loadingAction !== null}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-60"
          >
            {loadingAction === 'resume' ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
            <span>Turn On Engine (Restore Power)</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-center text-xs text-slate-500 hover:text-slate-700 font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
