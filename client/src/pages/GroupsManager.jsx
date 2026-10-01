import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useFleet } from '../contexts/FleetContext';
import { 
  FolderTree, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Truck, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  ArrowRightLeft,
  ChevronRight
} from 'lucide-react';

export default function GroupsManager() {
  const { allDevices, loadTelemetryFeed } = useFleet();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [parentGroupId, setParentGroupId] = useState(0);
  const [description, setDescription] = useState('');

  // Reassign Modal
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [targetDevice, setTargetDevice] = useState(null);
  const [newGroupId, setNewGroupId] = useState(0);
  const [reassigning, setReassigning] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/groups');
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load groups:', err);
      showFeedback('error', 'Failed to retrieve fleet groups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openAddModal = () => {
    setModalMode('add');
    setCurrentId('');
    setGroupName('');
    setParentGroupId(0);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (grp) => {
    setModalMode('edit');
    setCurrentId(grp.id);
    setGroupName(grp.name || '');
    setParentGroupId(grp.groupId || 0);
    setDescription(grp.attributes?.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      showFeedback('error', 'Group name is required.');
      return;
    }

    setSaving(true);
    const payload = {
      name: groupName.trim(),
      groupId: parseInt(parentGroupId) || 0,
      attributes: {
        description: description.trim()
      }
    };

    try {
      if (modalMode === 'add') {
        await axios.post('/api/groups', payload);
        showFeedback('success', `Group "${groupName}" created successfully.`);
      } else {
        await axios.put(`/api/groups/${currentId}`, payload);
        showFeedback('success', `Group "${groupName}" updated successfully.`);
      }
      setIsModalOpen(false);
      fetchGroups();
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Failed to save group.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const assignedCount = allDevices.filter(d => d.groupId === id).length;
    if (assignedCount > 0) {
      if (!window.confirm(`This group contains ${assignedCount} active vehicle(s). Deleting it will unassign those vehicles. Proceed?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete group "${name}"?`)) return;
    }

    try {
      await axios.delete(`/api/groups/${id}`);
      showFeedback('success', `Group "${name}" deleted.`);
      fetchGroups();
      loadTelemetryFeed();
    } catch (err) {
      showFeedback('error', err.response?.data?.error || 'Failed to delete group.');
    }
  };

  const openReassignModal = (device) => {
    setTargetDevice(device);
    setNewGroupId(device.groupId || 0);
    setIsReassignModalOpen(true);
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!targetDevice) return;

    setReassigning(true);
    try {
      await axios.put(`/api/devices/${targetDevice.id}`, {
        ...targetDevice,
        groupId: parseInt(newGroupId) || 0
      });
      showFeedback('success', `Vehicle "${targetDevice.name || targetDevice.uniqueId}" reassigned successfully.`);
      setIsReassignModalOpen(false);
      loadTelemetryFeed();
    } catch (err) {
      showFeedback('error', 'Failed to update vehicle group.');
    } finally {
      setReassigning(false);
    }
  };

  const filteredGroups = groups.filter(g => {
    const term = search.toLowerCase();
    return g.name && g.name.toLowerCase().includes(term);
  });

  // Unassigned vehicles count
  const unassignedVehicles = allDevices.filter(d => !d.groupId || d.groupId === 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center shadow-xs">
            <FolderTree size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Fleet Groups & Divisions</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                {groups.length} Groups
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Organize your vehicles into departmental divisions, branches, or customer sub-fleets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchGroups}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Refresh groups"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Create New Group</span>
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

      {/* Search & Overview Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search group name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
          <span>Total Fleet: <strong className="text-slate-900 font-mono">{allDevices.length}</strong> vehicles</span>
          <span className="text-slate-300">•</span>
          <span>Unassigned: <strong className="text-amber-600 font-mono">{unassignedVehicles.length}</strong></span>
        </div>
      </div>

      {/* Groups Grid */}
      {loading && groups.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          <RefreshCw size={24} className="animate-spin mx-auto text-violet-500 mb-2" />
          <p className="font-bold text-slate-600">Loading fleet groups...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Default Unassigned Group Card */}
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">General (Unassigned)</h3>
                    <span className="text-[10px] text-slate-400 font-mono">Default Root Pool</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 font-mono">
                  {unassignedVehicles.length} Vehicles
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Vehicles not assigned to any specific branch or department.
              </p>

              {/* Sample list of unassigned vehicles */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded-xl text-xs">
                {unassignedVehicles.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-2">All vehicles are organized into groups!</p>
                ) : (
                  unassignedVehicles.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Truck size={12} className="text-slate-400" />
                        <span className="font-bold text-slate-800">{d.name || d.uniqueId}</span>
                      </div>
                      <button
                        onClick={() => openReassignModal(d)}
                        className="text-[10px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-0.5"
                      >
                        <span>Assign</span>
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-mono mt-3">
              System Default Group
            </div>
          </div>

          {/* Configured Fleet Groups */}
          {filteredGroups.map((grp) => {
            const assignedDevices = allDevices.filter(d => d.groupId === grp.id);

            return (
              <div
                key={grp.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                        <FolderTree size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 leading-tight">{grp.name}</h3>
                        <span className="text-[10px] font-mono text-slate-400">ID: #{grp.id}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200 font-mono">
                      {assignedDevices.length} Vehicles
                    </span>
                  </div>

                  {grp.attributes?.description && (
                    <p className="text-[11px] text-slate-500 mb-3 italic">
                      "{grp.attributes.description}"
                    </p>
                  )}

                  {/* Vehicles List under this group */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded-xl text-xs mb-3">
                    {assignedDevices.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">No vehicles assigned to this group yet.</p>
                    ) : (
                      assignedDevices.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Truck size={12} className="text-violet-600" />
                            <span className="font-bold text-slate-800">{d.name || d.uniqueId}</span>
                          </div>
                          <button
                            onClick={() => openReassignModal(d)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                            title="Move to another group"
                          >
                            <ArrowRightLeft size={10} />
                            <span>Move</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(grp)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                  >
                    <Edit size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(grp.id, grp.name)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition flex items-center gap-1"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Group Modal */}
      {isModalOpen && (
        <div className="modal-backdrop-fixed z-50 flex items-center justify-center p-4">
          <div className="modal-sheet-card max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <FolderTree size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {modalMode === 'add' ? 'Create Fleet Group' : `Edit Group (${groupName})`}
                  </h3>
                  <p className="text-xs text-slate-500">Categorize vehicles by depot, customer, or route</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Group / Division Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North Zone Deliveries"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full form-input text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Parent Hierarchy Group
                </label>
                <select
                  value={parentGroupId}
                  onChange={(e) => setParentGroupId(e.target.value)}
                  className="w-full form-input text-xs font-bold"
                >
                  <option value={0}>-- Top-Level Fleet Group --</option>
                  {groups.filter(g => g.id !== currentId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Description / Department Details
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dedicated cold-chain trucks based in Delhi hub"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl text-xs hover:shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <RefreshCw size={14} className="animate-spin" />}
                  <span>{modalMode === 'add' ? 'Create Group' : 'Update Group'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move / Reassign Vehicle Modal */}
      {isReassignModalOpen && targetDevice && (
        <div className="modal-backdrop-fixed z-50 flex items-center justify-center p-4">
          <div className="modal-sheet-card max-w-md w-full bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Reassign Vehicle Group</h3>
                  <p className="text-xs text-slate-500">{targetDevice.name || targetDevice.uniqueId}</p>
                </div>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Destination Fleet Group
                </label>
                <select
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  className="w-full form-input text-xs font-bold"
                >
                  <option value={0}>General (Unassigned)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs hover:shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {reassigning && <RefreshCw size={14} className="animate-spin" />}
                  <span>Save Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
