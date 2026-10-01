import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useFleet } from '../contexts/FleetContext';
import { 
  Wrench, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Truck, 
  Gauge, 
  ShieldAlert, 
  X, 
  RefreshCw, 
  History, 
  IndianRupee, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const PRESETS = [
  {
    name: 'Engine Oil & Filter Replacement',
    type: 'totalDistance',
    periodKm: 10000,
    periodMeters: 10000000,
    icon: '🛢️',
    desc: 'Synthetic oil drain and oil filter change'
  },
  {
    name: 'Tire Rotation & Wheel Alignment',
    type: 'totalDistance',
    periodKm: 15000,
    periodMeters: 15000000,
    icon: '🛞',
    desc: '4-wheel rotation, balancing & alignment'
  },
  {
    name: 'Brake Pads & Fluid Service',
    type: 'totalDistance',
    periodKm: 25000,
    periodMeters: 25000000,
    icon: '🛑',
    desc: 'Front/rear brake pad inspection and bleeding'
  },
  {
    name: 'Annual Vehicle Insurance Policy',
    type: 'date',
    days: 365,
    icon: '🛡️',
    desc: 'Comprehensive commercial vehicle insurance renewal'
  },
  {
    name: 'Pollution Under Control (PUC) / Fitness',
    type: 'date',
    days: 180,
    icon: '📋',
    desc: 'Statutory emissions certification & RTO fitness'
  }
];

export default function MaintenanceHub() {
  const { allDevices } = useFleet();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [feedback, setFeedback] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState('');

  // Form Fields
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('totalDistance');
  const [intervalKm, setIntervalKm] = useState(10000);
  const [targetDate, setTargetDate] = useState('');
  const [startKm, setStartKm] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [notes, setNotes] = useState('');

  // Complete Service Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completingSchedule, setCompletingSchedule] = useState(null);
  const [completeCost, setCompleteCost] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeOdoKm, setCompleteOdoKm] = useState('');
  const [completingLoading, setCompletingLoading] = useState(false);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/maintenance');
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load maintenance schedules:', err);
      showFeedback('error', 'Failed to retrieve maintenance schedules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openAddModal = (preset = null) => {
    setModalMode('add');
    setCurrentId('');
    setSelectedDeviceId(allDevices[0]?.id ? String(allDevices[0].id) : '');
    
    if (preset) {
      setServiceName(preset.name);
      setServiceType(preset.type);
      if (preset.type === 'totalDistance') {
        setIntervalKm(preset.periodKm);
      } else {
        const d = new Date();
        d.setDate(d.getDate() + (preset.days || 365));
        setTargetDate(d.toISOString().split('T')[0]);
      }
      setNotes(preset.desc);
    } else {
      setServiceName('Scheduled Oil Change');
      setServiceType('totalDistance');
      setIntervalKm(10000);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setTargetDate(nextYear.toISOString().split('T')[0]);
      setNotes('');
    }

    setStartKm(0);
    setEstimatedCost('');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode('edit');
    setCurrentId(item.id);
    setSelectedDeviceId(item.deviceId ? String(item.deviceId) : '');
    setServiceName(item.name || '');
    setServiceType(item.type || 'totalDistance');
    setIntervalKm(Math.round((item.period || 10000000) / 1000));
    setStartKm(Math.round((item.start || 0) / 1000));
    setTargetDate(item.targetDate ? item.targetDate.split('T')[0] : '');
    setEstimatedCost(item.cost || '');
    setNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      showFeedback('error', 'Service name is required.');
      return;
    }
    if (!selectedDeviceId) {
      showFeedback('error', 'Please select a vehicle.');
      return;
    }

    setSaving(true);
    const dev = allDevices.find(d => String(d.id) === String(selectedDeviceId));
    const payload = {
      name: serviceName.trim(),
      deviceId: parseInt(selectedDeviceId),
      deviceName: dev ? (dev.name || dev.uniqueId) : '',
      type: serviceType,
      period: serviceType === 'totalDistance' ? (Number(intervalKm) || 10000) * 1000 : 0,
      start: serviceType === 'totalDistance' ? (Number(startKm) || 0) * 1000 : 0,
      targetDate: serviceType === 'date' ? new Date(targetDate).toISOString() : null,
      cost: Number(estimatedCost) || 0,
      notes: notes.trim()
    };

    try {
      if (modalMode === 'add') {
        await axios.post('/api/maintenance', payload);
        showFeedback('success', `Schedule "${serviceName}" created successfully.`);
      } else {
        await axios.put(`/api/maintenance/${currentId}`, payload);
        showFeedback('success', `Schedule "${serviceName}" updated successfully.`);
      }
      setIsModalOpen(false);
      fetchSchedules();
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Failed to save maintenance schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete maintenance schedule "${name}"?`)) return;
    try {
      await axios.delete(`/api/maintenance/${id}`);
      showFeedback('success', 'Maintenance schedule deleted.');
      fetchSchedules();
    } catch (err) {
      showFeedback('error', 'Failed to delete schedule.');
    }
  };

  const openCompleteModal = (item) => {
    setCompletingSchedule(item);
    setCompleteCost(item.cost ? String(item.cost) : '');
    setCompleteOdoKm(item.currentOdometerKm ? String(item.currentOdometerKm) : '');
    setCompleteNotes('Routine service completed');
    setIsCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!completingSchedule) return;

    setCompletingLoading(true);
    try {
      await axios.post(`/api/maintenance/${completingSchedule.id}/complete`, {
        cost: completeCost,
        notes: completeNotes,
        odometerKm: completeOdoKm,
        performedBy: 'Fleet Workshop'
      });
      showFeedback('success', `Service "${completingSchedule.name}" marked as completed! Rolled over to next cycle.`);
      setIsCompleteModalOpen(false);
      fetchSchedules();
    } catch (err) {
      showFeedback('error', 'Failed to record service completion.');
    } finally {
      setCompletingLoading(false);
    }
  };

  // Status Metrics
  const overdueCount = schedules.filter(s => s.status === 'OVERDUE').length;
  const dueSoonCount = schedules.filter(s => s.status === 'DUE_SOON').length;
  const healthyCount = schedules.filter(s => s.status === 'OK').length;

  const filteredSchedules = schedules.filter(s => {
    const term = search.toLowerCase();
    const dev = allDevices.find(d => String(d.id) === String(s.deviceId));
    const matchesSearch = (
      (s.name && s.name.toLowerCase().includes(term)) ||
      (s.deviceName && s.deviceName.toLowerCase().includes(term)) ||
      (dev?.name && dev.name.toLowerCase().includes(term)) ||
      (s.notes && s.notes.toLowerCase().includes(term))
    );
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
            <Wrench size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Maintenance & Service Hub</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {schedules.length} Schedules Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Automated telematics service reminders (Engine Oil, Tires, Brakes, Insurance, and PUC)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchSchedules}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Refresh maintenance list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => openAddModal()}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Add Service Schedule</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Schedules</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-slate-900 font-mono">{schedules.length}</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Wrench size={15} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Overdue Alerts</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-rose-600 font-mono">{overdueCount}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
              Immediate Action
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">Due Soon</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-amber-600 font-mono">{dueSoonCount}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              &lt; 500 km / 14 days
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">Good Standing</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-emerald-600 font-mono">{healthyCount}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              OK
            </span>
          </div>
        </div>
      </div>

      {/* Quick 1-Click Service Presets Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-2.5">
          <Sparkles size={15} className="text-amber-500" />
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Quick 1-Click Standard Fleet Presets
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => openAddModal(preset)}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/50 transition text-left group flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{preset.icon}</span>
                <strong className="text-[11px] font-black text-slate-900 group-hover:text-amber-800 leading-tight">
                  {preset.name.split('&')[0]}
                </strong>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 mt-1">
                {preset.type === 'totalDistance' ? `Every ${preset.periodKm.toLocaleString()} km` : `Every ${preset.days} days`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Floating Feedback Banner */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between animate-fade-in ${
          feedback.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? <AlertTriangle size={16} className="text-rose-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by vehicle, service, or note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs form-input py-1.5 px-3 bg-white border-slate-200 rounded-xl font-bold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="OVERDUE">Overdue Only</option>
            <option value="DUE_SOON">Due Soon Only</option>
            <option value="OK">Healthy Only</option>
          </select>
        </div>
      </div>

      {/* Maintenance Cards List */}
      {loading && schedules.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          <RefreshCw size={24} className="animate-spin mx-auto text-amber-500 mb-2" />
          <p className="font-bold text-slate-600">Analyzing fleet telemetry and maintenance schedules...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          <Wrench size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-slate-600">No maintenance schedules found</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Use the 1-Click Standard Presets above to configure preventative service intervals for your vehicles.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSchedules.map((item) => {
            const dev = allDevices.find(d => String(d.id) === String(item.deviceId));
            const devName = item.deviceName || dev?.name || dev?.uniqueId || `Device #${item.deviceId}`;
            const isOverdue = item.status === 'OVERDUE';
            const isDueSoon = item.status === 'DUE_SOON';
            const progress = Math.min(100, Math.max(0, item.progressPercent || 0));

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition relative overflow-hidden flex flex-col justify-between ${
                  isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : (isDueSoon ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200')
                }`}
              >
                {/* Top Accent Strip */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                  isOverdue ? 'bg-rose-500' : (isDueSoon ? 'bg-amber-500' : 'bg-emerald-500')
                }`} />

                <div>
                  {/* Card Title & Vehicle Info */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isOverdue ? 'bg-rose-100 text-rose-700' : (isDueSoon ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')
                      }`}>
                        <Wrench size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight">{item.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Truck size={12} />
                            <span>{devName}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">ID: {item.id}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono tracking-wider ${
                      isOverdue 
                        ? 'bg-rose-100 text-rose-800 animate-pulse' 
                        : (isDueSoon ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800')
                    }`}>
                      {isOverdue ? 'OVERDUE' : (isDueSoon ? 'DUE SOON' : 'HEALTHY')}
                    </span>
                  </div>

                  {/* Progress Bar & Reading Status */}
                  <div className="space-y-1.5 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500 text-[11px]">
                        {item.type === 'totalDistance' ? 'Interval Progress' : 'Time Remaining'}
                      </span>
                      <span className="font-mono text-slate-900">
                        {item.type === 'totalDistance' ? (
                          <>
                            {item.remainingKm !== null ? (
                              item.remainingKm <= 0 ? (
                                <strong className="text-rose-600">{Math.abs(item.remainingKm).toLocaleString()} km overdue</strong>
                              ) : (
                                <strong className={isDueSoon ? 'text-amber-600' : 'text-slate-700'}>
                                  {item.remainingKm.toLocaleString()} km remaining
                                </strong>
                              )
                            ) : '--'}
                          </>
                        ) : (
                          <>
                            {item.remainingDays !== null ? (
                              item.remainingDays < 0 ? (
                                <strong className="text-rose-600">{Math.abs(item.remainingDays)} days overdue</strong>
                              ) : (
                                <strong className={isDueSoon ? 'text-amber-600' : 'text-slate-700'}>
                                  {item.remainingDays} days remaining
                                </strong>
                              )
                            ) : '--'}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isOverdue ? 'bg-rose-500' : (isDueSoon ? 'bg-amber-500' : 'bg-emerald-500')
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                      {item.type === 'totalDistance' ? (
                        <>
                          <span>Odo: {item.currentOdometerKm?.toLocaleString() || 0} km</span>
                          <span>Target: {Math.round((item.start + item.period) / 1000).toLocaleString()} km</span>
                        </>
                      ) : (
                        <>
                          <span>Today</span>
                          <span>Target Date: {item.targetDate ? new Date(item.targetDate).toLocaleDateString('en-IN') : 'N/A'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes & Past History Summary */}
                  {item.notes && (
                    <p className="text-[11px] text-slate-600 italic mb-3">
                      "{item.notes}"
                    </p>
                  )}

                  {/* Completed History Accordion */}
                  {Array.isArray(item.history) && item.history.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 mb-2">
                      <button
                        onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <History size={12} />
                        <span>Service History ({item.history.length})</span>
                        {expandedHistoryId === item.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {expandedHistoryId === item.id && (
                        <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto bg-slate-50 p-2 rounded-lg text-[10px]">
                          {item.history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0">
                              <div>
                                <strong className="text-slate-800">{new Date(h.completedAt).toLocaleDateString('en-IN')}</strong>
                                <span className="text-slate-400 ml-1">({h.performedBy})</span>
                                <p className="text-slate-500">{h.notes}</p>
                              </div>
                              <span className="font-mono font-bold text-slate-700">
                                {h.odometerKm ? `${Number(h.odometerKm).toLocaleString()} km` : ''}
                                {h.cost ? ` • ₹${h.cost}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    {item.lastServiceDate && (
                      <span>Last done: {new Date(item.lastServiceDate).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openCompleteModal(item)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition flex items-center gap-1"
                      title="Mark service performed and roll forward schedule"
                    >
                      <CheckCircle2 size={13} />
                      <span>Mark Done</span>
                    </button>

                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="Edit Schedule"
                    >
                      <Edit size={14} />
                    </button>

                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                      title="Delete Schedule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="modal-backdrop-fixed z-50 flex items-center justify-center p-4">
          <div className="modal-sheet-card max-w-lg w-full bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {modalMode === 'add' ? 'Create Maintenance Schedule' : `Edit Schedule (${serviceName})`}
                  </h3>
                  <p className="text-xs text-slate-500">Track odometer milestones or calendar renewals</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Target Vehicle <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full form-input text-xs font-bold"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {allDevices.map(dev => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name || dev.uniqueId} ({dev.model || 'Tracker'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engine Oil & Filter Change"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full form-input text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Trigger Type
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full form-input text-xs font-bold"
                  >
                    <option value="totalDistance">Odometer (Distance In Km)</option>
                    <option value="date">Calendar Expiry Date</option>
                  </select>
                </div>

                {serviceType === 'totalDistance' ? (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Interval (Every X Km)
                    </label>
                    <input
                      type="number"
                      required
                      min={100}
                      step={100}
                      placeholder="10000"
                      value={intervalKm}
                      onChange={(e) => setIntervalKm(e.target.value)}
                      className="w-full form-input text-xs font-mono font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Target Due Date
                    </label>
                    <input
                      type="date"
                      required
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full form-input text-xs font-medium"
                    />
                  </div>
                )}
              </div>

              {serviceType === 'totalDistance' && modalMode === 'edit' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Base Start Reading (Km)
                  </label>
                  <input
                    type="number"
                    value={startKm}
                    onChange={(e) => setStartKm(e.target.value)}
                    className="w-full form-input text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Next service due at Base + Interval km</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Estimated Service Cost (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 3500"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  className="w-full form-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Service Instructions & Workshop Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Use 15W-40 heavy grade oil; verify oil sump washer"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full form-input text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl text-xs hover:shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  <span>{modalMode === 'add' ? 'Save Schedule' : 'Update Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Completed Modal */}
      {isCompleteModalOpen && completingSchedule && (
        <div className="modal-backdrop-fixed z-50 flex items-center justify-center p-4">
          <div className="modal-sheet-card max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Record Completed Service</h3>
                  <p className="text-xs text-slate-500">{completingSchedule.name}</p>
                </div>
              </div>
              <button onClick={() => setIsCompleteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Actual Odometer Reading (Km)
                </label>
                <input
                  type="number"
                  required
                  value={completeOdoKm}
                  onChange={(e) => setCompleteOdoKm(e.target.value)}
                  className="w-full form-input text-xs font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Next interval will automatically start from this reading
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Incurred Cost (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 4200"
                  value={completeCost}
                  onChange={(e) => setCompleteCost(e.target.value)}
                  className="w-full form-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Service Notes / Workshop Receipt No.
                </label>
                <textarea
                  rows={2}
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="w-full form-input text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completingLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs hover:shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {completingLoading && <RefreshCw size={14} className="animate-spin" />}
                  <span>Record & Roll Forward</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
