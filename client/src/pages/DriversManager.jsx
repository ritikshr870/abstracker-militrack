import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useFleet } from '../contexts/FleetContext';
import { 
  UserCheck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  CreditCard, 
  Truck, 
  X, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  User,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export default function DriversManager() {
  const { allDevices } = useFleet();

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form Fields
  const [currentId, setCurrentId] = useState('');
  const [name, setName] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [phone, setPhone] = useState('');
  const [license, setLicense] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [notes, setNotes] = useState('');

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/drivers');
      setDrivers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load drivers:', err);
      showFeedback('error', 'Failed to retrieve driver records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openAddModal = () => {
    setModalMode('add');
    setCurrentId('');
    setName('');
    setUniqueId(`RFID-${Math.floor(1000 + Math.random() * 9000)}`);
    setPhone('');
    setLicense('');
    setSelectedDeviceId('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (driver) => {
    setModalMode('edit');
    setCurrentId(driver.id);
    setName(driver.name || '');
    setUniqueId(driver.uniqueId || '');
    setPhone(driver.attributes?.phone || '');
    setLicense(driver.attributes?.license || '');
    setSelectedDeviceId(driver.deviceId || driver.attributes?.deviceId || '');
    setNotes(driver.attributes?.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showFeedback('error', 'Driver name is required.');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      uniqueId: uniqueId.trim() || `DRV-${Math.floor(10000 + Math.random() * 90000)}`,
      deviceId: selectedDeviceId ? parseInt(selectedDeviceId) : null,
      attributes: {
        phone: phone.trim(),
        license: license.trim(),
        notes: notes.trim(),
        deviceId: selectedDeviceId ? parseInt(selectedDeviceId) : null
      }
    };

    try {
      if (modalMode === 'add') {
        const res = await axios.post('/api/drivers', payload);
        if (res.data) {
          showFeedback('success', `Driver "${name}" registered successfully.`);
          setIsModalOpen(false);
          fetchDrivers();
        }
      } else {
        const res = await axios.put(`/api/drivers/${currentId}`, payload);
        if (res.data) {
          showFeedback('success', `Driver "${name}" updated successfully.`);
          setIsModalOpen(false);
          fetchDrivers();
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Error saving driver.';
      showFeedback('error', errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, driverName) => {
    if (!window.confirm(`Are you sure you want to delete driver "${driverName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await axios.delete(`/api/drivers/${id}`);
      showFeedback('success', `Driver "${driverName}" deleted.`);
      fetchDrivers();
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Failed to delete driver.');
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    if (!drivers.length) return;
    const headers = ['ID', 'Driver Name', 'RFID/UniqueId', 'Phone', 'License', 'Assigned Vehicle'];
    const rows = drivers.map(d => {
      const dev = allDevices.find(dev => String(dev.id) === String(d.deviceId || d.attributes?.deviceId));
      return [
        d.id,
        `"${d.name || ''}"`,
        `"${d.uniqueId || ''}"`,
        `"${d.attributes?.phone || ''}"`,
        `"${d.attributes?.license || ''}"`,
        `"${dev?.name || dev?.uniqueId || 'Unassigned'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `drivers_roster_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDrivers = drivers.filter(d => {
    const term = search.toLowerCase();
    const dev = allDevices.find(dev => String(dev.id) === String(d.deviceId || d.attributes?.deviceId));
    return (
      (d.name && d.name.toLowerCase().includes(term)) ||
      (d.uniqueId && d.uniqueId.toLowerCase().includes(term)) ||
      (d.attributes?.phone && d.attributes.phone.toLowerCase().includes(term)) ||
      (d.attributes?.license && d.attributes.license.toLowerCase().includes(term)) ||
      (dev?.name && dev.name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Drivers Directory</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {drivers.length} Registered
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Manage authorized fleet drivers, RFID tags, driving licenses, and vehicle assignments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchDrivers}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Refresh driver list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Add New Driver</span>
          </button>
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

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search driver by name, phone, RFID, or vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
          <span>Showing <strong className="text-slate-900 font-mono">{filteredDrivers.length}</strong> of {drivers.length} drivers</span>
        </div>
      </div>

      {/* Drivers Roster Cards Grid */}
      {loading && drivers.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          <RefreshCw size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
          <p className="font-bold text-slate-600">Loading driver roster...</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          <User size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-slate-600">No driver records found</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {search ? 'No drivers match your search query.' : 'Click "Add New Driver" to enroll your first fleet driver.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => {
            const assignedDevice = allDevices.find(dev => String(dev.id) === String(driver.deviceId || driver.attributes?.deviceId));
            const driverPhone = driver.attributes?.phone || '';
            const cleanPhone = driverPhone.replace(/[^0-9]/g, '');

            return (
              <div
                key={driver.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                        {driver.name ? driver.name.substring(0, 2).toUpperCase() : 'DR'}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight">{driver.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {driver.uniqueId}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">#{driver.id}</span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      Active
                    </span>
                  </div>

                  {/* Driver Details List */}
                  <div className="space-y-2 py-2 border-y border-slate-100 text-xs font-medium">
                    {/* Phone */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone size={13} className="text-slate-400" />
                        <span>Phone:</span>
                      </div>
                      {driverPhone ? (
                        <div className="flex items-center gap-2">
                          <a 
                            href={`tel:${cleanPhone}`} 
                            className="font-bold text-blue-600 hover:underline font-mono"
                          >
                            {driverPhone}
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            title="Chat on WhatsApp"
                          >
                            WA
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono italic">Not provided</span>
                      )}
                    </div>

                    {/* License */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <CreditCard size={13} className="text-slate-400" />
                        <span>License:</span>
                      </div>
                      <span className="font-bold text-slate-800 font-mono">
                        {driver.attributes?.license || 'None on file'}
                      </span>
                    </div>

                    {/* Assigned Vehicle */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Truck size={13} className="text-slate-400" />
                        <span>Vehicle:</span>
                      </div>
                      {assignedDevice ? (
                        <span className="font-bold text-slate-900 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[11px]">
                          {assignedDevice.name || assignedDevice.uniqueId}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                      )}
                    </div>

                    {/* Notes if present */}
                    {driver.attributes?.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                        "{driver.attributes.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    onClick={() => openEditModal(driver)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                  >
                    <Edit size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    disabled={deletingId === driver.id}
                    onClick={() => handleDelete(driver.id, driver.name)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    <span>{deletingId === driver.id ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Driver Modal */}
      {isModalOpen && (
        <div className="modal-backdrop-fixed z-50 flex items-center justify-center p-4">
          <div className="modal-sheet-card max-w-lg w-full bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {modalMode === 'add' ? 'Enroll New Fleet Driver' : `Edit Driver (${name})`}
                  </h3>
                  <p className="text-xs text-slate-500">Configure credentials, RFID code, and vehicle assignment</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Driver Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full form-input text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    RFID / Unique Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RFID-8492 or Employee ID"
                    value={uniqueId}
                    onChange={(e) => setUniqueId(e.target.value)}
                    className="w-full form-input text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Used for RFID iButton telematics swipe</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full form-input text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Driving License Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DL-042021008899"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    className="w-full form-input text-xs font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Assigned Vehicle
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="w-full form-input text-xs font-bold"
                  >
                    <option value="">-- None (Pool Driver) --</option>
                    {allDevices.map(dev => (
                      <option key={dev.id} value={dev.id}>
                        {dev.name || dev.uniqueId} ({dev.model || 'Tracker'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Operational Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Day shift, heavy commercial permit valid till 2027"
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
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-xs hover:shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  <span>{modalMode === 'add' ? 'Save Driver' : 'Update Driver'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
