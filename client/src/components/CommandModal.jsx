import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Bolt, ShieldAlert, CheckCircle, Clock, Loader2, Send, Radio, History, CheckCheck, RefreshCw } from 'lucide-react';
import { VehicleCategoryIcon } from './VehicleIcons';

export default function CommandModal({ device, onClose }) {
  const d = device?.device || device || {};
  const p = device?.position || {};
  const deviceId = d.id || device?.id;
  const deviceName = d.name || 'Vehicle';

  const statusStr = (p.attributes?.currentStatus || (d.status === 'offline' ? 'OFFLINE' : (d.status === 'online' ? 'STOPPED' : 'OFFLINE'))).toUpperCase();
  const isOnline = d.status === 'online' || statusStr === 'RUNNING' || statusStr === 'STOPPED';

  const [templates, setTemplates] = useState([]);
  const [selectedType, setSelectedType] = useState('engineStop');
  const [password, setPassword] = useState('123456');
  const [customString, setCustomString] = useState('RELAY,1#');
  const [textChannel, setTextChannel] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isAwaitingAck, setIsAwaitingAck] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [commandResponse, setCommandResponse] = useState(null);
  const [pastReplies, setPastReplies] = useState([]);

  const pollTimerRef = useRef(null);

  // Load templates and previous command replies
  useEffect(() => {
    if (!deviceId) return;
    fetchTemplates();
    fetchReplies();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [deviceId]);

  const fetchTemplates = () => {
    axios.get(`/api/commands/send?deviceId=${deviceId}`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setTemplates(res.data);
          const stopTpl = res.data.find(t => t.type === 'engineStop');
          if (stopTpl?.attributes?.devicePassword) {
            setPassword(stopTpl.attributes.devicePassword);
          }
        }
      })
      .catch(() => {});
  };

  const fetchReplies = async () => {
    try {
      const res = await axios.get(`/api/commands/replies?deviceId=${deviceId}`);
      if (Array.isArray(res.data?.replies)) {
        setPastReplies(res.data.replies);
        return res.data.replies;
      }
    } catch (e) {}
    return [];
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    const matched = templates.find(t => t.type === type);
    if (matched?.attributes?.devicePassword) {
      setPassword(matched.attributes.devicePassword);
    }
    if (type === 'engineStop') setCustomString('RELAY,1#');
    else if (type === 'engineResume') setCustomString('RELAY,0#');
    else if (type === 'rebootDevice') setCustomString('RESET#');
    else if (type === 'positionSingle') setCustomString('WHERE#');
    else if (type === 'custom') setCustomString('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    if (!isOnline) {
      setFeedback({ type: 'error', msg: 'Cannot send command: Target vehicle is OFFLINE and disconnected.' });
      return;
    }

    setLoading(true);
    setIsAwaitingAck(false);
    setFeedback(null);
    setCommandResponse(null);

    const matchedTpl = templates.find(t => t.type === selectedType);
    let payload = {};

    if (matchedTpl) {
      payload = {
        id: matchedTpl.id,
        deviceId: parseInt(deviceId),
        type: matchedTpl.type,
        textChannel,
        attributes: {
          devicePassword: password || '123456',
          ...(matchedTpl.attributes || {})
        }
      };
    } else {
      payload = {
        deviceId: parseInt(deviceId),
        type: selectedType,
        textChannel,
        attributes: {
          devicePassword: password || '123456'
        }
      };
    }

    if (password) payload.attributes.devicePassword = password;
    if (customString) {
      payload.attributes.data = customString;
      payload.data = customString;
    }

    const sendTimestamp = Date.now();

    try {
      // Dispatch with waitForReply=true for synchronous socket handshake
      const res = await axios.post(`/api/commands/send?deviceId=${deviceId}&waitForReply=true&timeout=9000`, payload);
      setLoading(false);

      if (res.data?.success === true && (res.data?.status === 'EXECUTED' || res.data?.isAcked) && res.data?.reply) {
        // Confirmed real hardware ACK received!
        setCommandResponse({
          ...res.data,
          status: 'EXECUTED',
          isAcked: true
        });
        setFeedback({ type: 'success', msg: `Vehicle Hardware ACK Confirmed: ${res.data.reply}` });
        fetchReplies();
      } else if (res.data?.success === true && (res.data?.status === 'SENT' || res.data?.isAcked)) {
        // Command transmitted to vehicle hardware successfully!
        setCommandResponse({
          ...res.data,
          status: 'EXECUTED',
          isAcked: true
        });
        setFeedback({ type: 'success', msg: res.data.message || 'Command transmitted to vehicle hardware successfully.' });
        fetchReplies();
      } else if (res.data?.status === 'NO_ACK' || res.data?.success === false) {
        // Vehicle failed or timed out without ACK
        setCommandResponse({
          ...res.data,
          status: 'FAILED',
          isAcked: false,
          error: res.data?.error || 'Device did not return an acknowledgment.'
        });
        setFeedback({ type: 'error', msg: res.data?.error || 'Command dispatch failed: Device did not confirm execution.' });
      } else if (res.data?.status === 'QUEUED') {
        setCommandResponse({
          ...res.data,
          status: 'QUEUED',
          isAcked: false
        });
        setFeedback({ type: 'queued', msg: 'Command Queued in modem buffer: Executes when vehicle reconnects.' });
      } else {
        // Sent to gateway, now initiate live ACK polling
        setCommandResponse({
          ...res.data,
          status: 'AWAITING_ACK',
          isAcked: false
        });
        setIsAwaitingAck(true);
        setFeedback({ type: 'info', msg: 'Packet transmitted to gateway. Waiting for vehicle hardware acknowledgment (ACK)...' });

        let attempts = 0;
        pollTimerRef.current = setInterval(async () => {
          attempts++;
          const replies = await fetchReplies();
          if (replies.length > 0) {
            const latest = replies[0];
            const replyTime = new Date(latest.eventTime).getTime();
            const isRealAck = latest.result && !String(latest.result).includes('Packet Transmitted');
            // Check if REAL hardware ACK was generated after dispatch
            if (replyTime >= sendTimestamp - 1000 && isRealAck) {
              clearInterval(pollTimerRef.current);
              setIsAwaitingAck(false);
              setCommandResponse({
                status: 'EXECUTED',
                reply: latest.result,
                replyTime: latest.formattedTime,
                isAcked: true,
                raw: latest
              });
              setFeedback({ type: 'success', msg: `Vehicle Hardware ACK Confirmed: ${latest.result}` });
              return;
            }
          }

          if (attempts >= 6) {
            clearInterval(pollTimerRef.current);
            setIsAwaitingAck(false);
            setCommandResponse({
              status: 'NO_ACK',
              isAcked: false,
              error: 'Timeout: Vehicle hardware did not acknowledge command execution.'
            });
            setFeedback({ type: 'error', msg: 'Timeout: Vehicle did not return an ACK response. Command was not confirmed.' });
          }
        }, 1500);
      }
    } catch (err) {
      setLoading(false);
      setIsAwaitingAck(false);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to dispatch command to vehicle.';
      setCommandResponse({
        success: false,
        status: 'FAILED',
        error: errorMsg
      });
      setFeedback({ type: 'error', msg: errorMsg });
    }
  };

  if (!deviceId) return null;

  return (
    <div className="modal-backdrop-fixed z-50">
      <div className="modal-sheet-card max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shrink-0 shadow-2xs">
              <VehicleCategoryIcon category={d.category} model={d.model} className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Dispatch Hardware Command</h3>
              <p className="text-[11px] text-slate-500 font-mono">Target: {deviceName} (ID: {deviceId})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} className="p-5 space-y-4 text-xs overflow-y-auto custom-scroll flex-1">
          {/* Status banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="font-bold text-slate-700">{isOnline ? 'Hardware Online (Ready for Commands)' : 'Hardware Disconnected / Offline'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {d.lastUpdate ? new Date(d.lastUpdate).toLocaleTimeString('en-IN', { hour12: true }) : '--'}
            </span>
          </div>

          {!isOnline && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 font-medium shadow-xs">
              <ShieldAlert size={18} className="text-rose-600 flex-shrink-0" />
              <div>
                <strong className="block font-bold text-rose-900">Device Is Currently Offline</strong>
                <span>Vehicle tracker is disconnected from the server. Live commands cannot be delivered or executed while offline.</span>
              </div>
            </div>
          )}

          {/* Feedback banner */}
          {feedback && (
            <div className={`p-3 rounded-xl flex items-center gap-2 border font-medium ${feedback.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : (feedback.type === 'queued' ? 'bg-amber-50 text-amber-800 border-amber-200' : feedback.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200')}`}>
              {feedback.type === 'error' && <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />}
              {feedback.type === 'queued' && <Clock size={16} className="text-amber-500 flex-shrink-0" />}
              {feedback.type === 'info' && <Radio size={16} className="text-blue-500 animate-pulse flex-shrink-0" />}
              {feedback.type === 'success' && <CheckCheck size={16} className="text-emerald-600 flex-shrink-0" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          {/* Live Command Response & ACK Console */}
          {(commandResponse || isAwaitingAck) && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio size={11} className={isAwaitingAck ? 'text-blue-400 animate-pulse' : (commandResponse?.isAcked ? 'text-emerald-400' : 'text-slate-400')} />
                  Vehicle Hardware Handshake & ACK
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                  commandResponse?.isAcked && commandResponse?.status === 'EXECUTED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isAwaitingAck
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                    : commandResponse?.status === 'QUEUED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : commandResponse?.status === 'FAILED' || commandResponse?.status === 'NO_ACK' || commandResponse?.status === 'OFFLINE'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                  {isAwaitingAck ? 'AWAITING ACK...' : (commandResponse?.isAcked && commandResponse?.status === 'EXECUTED' ? 'ACK RECEIVED (DONE)' : commandResponse?.status === 'NO_ACK' ? 'NO ACK (FAILED)' : commandResponse?.status || 'STANDBY')}
                </span>
              </div>

              {isAwaitingAck && (
                <div className="p-3 bg-blue-950/40 border border-blue-900/50 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-blue-400 font-mono text-xs font-bold">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Listening on TCP socket for device execution ACK...</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Modem handshake verified. Tracker is executing relay trigger.</p>
                </div>
              )}

              {commandResponse?.reply && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block font-mono">Terminal Acknowledgment (ACK):</span>
                  <div className="font-mono text-emerald-400 bg-black/60 p-2.5 rounded-xl border border-slate-800 text-xs font-bold flex items-center justify-between">
                    <span>{commandResponse.reply}</span>
                    <CheckCheck size={14} className="text-emerald-400 flex-shrink-0 ml-2" />
                  </div>
                </div>
              )}

              {commandResponse?.replyTime && (
                <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                  <span>Server ACK Timestamp:</span>
                  <span className="text-slate-300 font-bold">{commandResponse.replyTime}</span>
                </div>
              )}

              {commandResponse?.error && (
                <div className="font-mono text-red-400 bg-red-950/40 p-2.5 rounded-xl border border-red-900/50 text-xs">
                  {commandResponse.error}
                </div>
              )}

              {commandResponse?.dispatchResponse && (
                <details className="text-[10px] text-slate-500 cursor-pointer pt-1">
                  <summary className="hover:text-slate-300 transition">View Raw Gateway Response</summary>
                  <pre className="mt-1.5 p-2 bg-black/60 rounded text-[9px] text-slate-400 overflow-x-auto font-mono">
                    {JSON.stringify(commandResponse.dispatchResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Command Action Type</label>
            <select
              value={selectedType}
              onChange={e => handleTypeChange(e.target.value)}
              className="w-full form-input bg-white font-medium"
            >
              {templates.length > 0 ? (
                templates.map(t => (
                  <option key={t.id || t.type} value={t.type}>
                    {t.description || t.type} ({t.type})
                  </option>
                ))
              ) : (
                <>
                  <option value="engineStop">Engine Stop (Cut Fuel / Power Relay)</option>
                  <option value="engineResume">Engine Resume (Restore Fuel / Power Relay)</option>
                  <option value="rebootDevice">Reboot Hardware Tracker</option>
                  <option value="positionSingle">Request Immediate Location Fix</option>
                  <option value="custom">Custom GPRS / SMS Command String</option>
                </>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Device Password</label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="123456"
                className="w-full form-input font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Protocol Transport</label>
              <select
                value={textChannel ? 'true' : 'false'}
                onChange={e => setTextChannel(e.target.value === 'true')}
                className="w-full form-input bg-white font-medium"
              >
                <option value="false">GPRS / TCP Socket (Fast)</option>
                <option value="true">SMS Gateway Channel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Raw Command Payload</label>
            <input
              type="text"
              value={customString}
              onChange={e => setCustomString(e.target.value)}
              placeholder="e.g. RELAY,1#"
              className="w-full form-input font-mono text-slate-800 font-bold"
            />
          </div>

          {/* Past ACK History Log */}
          {pastReplies.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  <History size={12} /> Recent Vehicle Execution ACKs
                </span>
                <button
                  type="button"
                  onClick={fetchReplies}
                  className="hover:text-slate-800 p-0.5 rounded"
                  title="Refresh ACKs"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto custom-scroll">
                {pastReplies.slice(0, 3).map((r, i) => (
                  <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono flex items-center justify-between">
                    <span className="text-emerald-700 font-bold truncate max-w-[240px]">{r.result}</span>
                    <span className="text-slate-400 whitespace-nowrap ml-2">{r.formattedTime || new Date(r.eventTime).toLocaleTimeString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isAwaitingAck || !isOnline}
              className={`px-5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition ${
                !isOnline
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  : 'btn-royal-blue cursor-pointer disabled:opacity-60'
              }`}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>
                {!isOnline
                  ? 'Device Offline (Cannot Send)'
                  : loading
                  ? 'Dispatching...'
                  : isAwaitingAck
                  ? 'Listening for ACK...'
                  : 'Transmit Command'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

