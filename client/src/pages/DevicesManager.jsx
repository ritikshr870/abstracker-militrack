import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useFleet } from '../contexts/FleetContext';
import { Plus, Search, Edit, Trash2, X, Truck, User, MapPin, Calendar, Clock, PlusCircle, Save } from 'lucide-react';
import { VehicleCategoryIcon } from '../components/VehicleIcons';

export default function DevicesManager() {
  const {
    allDevices,
    allUsers,
    allGroups,
    allGeofences,
    metadata,
    loadAuxiliaryData,
    loadTelemetryFeed
  } = useFleet();

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [devId, setDevId] = useState('');
  const [name, setName] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [phone, setPhone] = useState('');
  const [model, setModel] = useState('');
  const [groupId, setGroupId] = useState(0);
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('car');
  const [expiryDate, setExpiryDate] = useState('');

  // Connected Users
  const [linkedUserIds, setLinkedUserIds] = useState([]);
  const [userSearchText, setUserSearchText] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  // Linked Geofences
  const [linkedGeofenceIds, setLinkedGeofenceIds] = useState([]);
  const [selectedGeofenceToAdd, setSelectedGeofenceToAdd] = useState('');

  // Dynamic Attributes
  const [attributesList, setAttributesList] = useState([]);

  const modelsList = metadata.models?.length ? metadata.models : ['G11 (5023)', 'AQULA 140', 'Wetrack 140', 'Concox GT06N', 'Teltonika FMB920'];
  const categoriesList = metadata.categories?.length ? metadata.categories : ['car', 'truck', 'bus', 'motorcycle', 'tractor', 'van', 'pickup'];

  const openModal = (mode, device = null) => {
    setModalMode(mode);
    if (mode === 'edit' && device) {
      setDevId(device.id);
      setName(device.name || '');
      setUniqueId(device.uniqueId || '');
      setPhone(device.phone || '');
      setModel(device.model || modelsList[0]);
      setGroupId(device.groupId || 0);
      setContact(device.contact || '');
      setCategory(device.category || 'car');
      setExpiryDate(device.expirationTime ? device.expirationTime.split('T')[0] : '');

      // Parse attributes
      const attrs = device.attributes || {};
      const attrRows = [];
      Object.keys(attrs).forEach(k => {
        if (k !== 'assignedUserIds') {
          attrRows.push({ id: Math.random().toString(), key: k, value: String(attrs[k]) });
        }
      });
      setAttributesList(attrRows);

      // Parse linked users
      let loadedUserIds = [];
      if (Array.isArray(attrs.assignedUserIds)) {
        loadedUserIds = [...attrs.assignedUserIds];
      } else {
        allUsers.forEach(u => {
          if (Array.isArray(u.deviceIds) && u.deviceIds.includes(device.id)) {
            if (!loadedUserIds.includes(u.id)) loadedUserIds.push(u.id);
          }
        });
      }
      setLinkedUserIds(loadedUserIds);

      // Parse linked geofences
      if (Array.isArray(device.geofenceIds)) {
        setLinkedGeofenceIds([...device.geofenceIds]);
      } else {
        setLinkedGeofenceIds([]);
      }
    } else {
      setDevId('');
      setName('');
      setUniqueId('');
      setPhone('');
      setModel(modelsList[0] || 'G11 (5023)');
      setGroupId(0);
      setContact('');
      setCategory('car');
      setExpiryDate('');
      setLinkedUserIds([]);
      setLinkedGeofenceIds([]);
      setAttributesList([
        { id: '1', key: 'Driver Name', value: '' },
        { id: '2', key: 'Speed Limit', value: '60' }
      ]);
    }

    setUserSearchText('');
    setSelectedUserToAdd('');
    setSelectedGeofenceToAdd('');
    setIsModalOpen(true);
  };

  const handleAddAttribute = () => {
    setAttributesList(prev => [...prev, { id: Math.random().toString(), key: '', value: '' }]);
  };

  const handleRemoveAttribute = (id) => {
    setAttributesList(prev => prev.filter(a => a.id !== id));
  };

  const handleAttributeChange = (id, field, val) => {
    setAttributesList(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  // User linking
  const handleLinkUser = async () => {
    const uId = parseInt(selectedUserToAdd);
    if (!uId || linkedUserIds.includes(uId)) return;
    setLinkedUserIds(prev => [...prev, uId]);
    setSelectedUserToAdd('');

    if (modalMode === 'edit' && devId) {
      await axios.post('/api/permissions', { userId: uId, deviceId: devId }).catch(() => {});
    }
  };

  const handleUnlinkUser = async (uId) => {
    setLinkedUserIds(prev => prev.filter(id => id !== uId));
    if (modalMode === 'edit' && devId) {
      await axios.delete('/api/permissions', { data: { userId: uId, deviceId: devId } }).catch(() => {});
    }
  };

  // Geofence linking
  const handleAddGeofence = () => {
    const gId = parseInt(selectedGeofenceToAdd);
    if (!gId || linkedGeofenceIds.includes(gId)) return;
    setLinkedGeofenceIds(prev => [...prev, gId]);
    setSelectedGeofenceToAdd('');
  };

  const handleRemoveGeofence = (gId) => {
    setLinkedGeofenceIds(prev => prev.filter(id => id !== gId));
  };

  // Save device
  const handleSaveDevice = async (e) => {
    e.preventDefault();
    if (!name.trim() || !uniqueId.trim()) {
      alert('Vehicle Number and IMEI are mandatory.');
      return;
    }

    setSaving(true);
    const attributes = {};
    attributesList.forEach(a => {
      const k = a.key.trim();
      const v = a.value.trim();
      if (k) attributes[k] = v;
    });
    attributes.assignedUserIds = linkedUserIds;

    const payload = {
      name: name.trim().toUpperCase(),
      uniqueId: uniqueId.trim(),
      phone: phone.trim(),
      model,
      contact: contact.trim(),
      category,
      geofenceIds: linkedGeofenceIds,
      attributes
    };

    if (parseInt(groupId) > 0) {
      payload.groupId = parseInt(groupId);
    }

    if (expiryDate) {
      payload.expirationTime = new Date(expiryDate).toISOString();
    }

    try {
      let savedDev;
      if (modalMode === 'edit' && devId) {
        payload.id = parseInt(devId);
        const res = await axios.put(`/api/devices/${devId}`, payload);
        savedDev = res.data;
      } else {
        const res = await axios.post('/api/devices', payload);
        savedDev = res.data;
        if (savedDev?.id && linkedUserIds.length > 0) {
          for (const uId of linkedUserIds) {
            await axios.post('/api/permissions', { userId: uId, deviceId: savedDev.id }).catch(() => {});
          }
        }
      }

      await loadAuxiliaryData();
      await loadTelemetryFeed();
      setIsModalOpen(false);
    } catch (err) {
      const errData = err.response?.data;
      let errMsg = 'Failed to save device specifications.';
      if (typeof errData === 'string') {
        if (errData.includes('Unique index') || errData.includes('already exist') || errData.includes('UNIQUE_KEY') || errData.includes('uniqueId')) {
          errMsg = 'This IMEI / Unique ID is already registered in the system. Please verify IMEI uniqueness.';
        } else if (errData.includes('deviceReadonly')) {
          errMsg = 'Account is restricted to device read-only.';
        } else {
          errMsg = errData.split('-')[0].trim();
        }
      } else if (errData?.error) {
        errMsg = errData.error;
      } else if (errData?.message) {
        errMsg = errData.message;
      } else if (err.message) {
        errMsg = err.message;
      }
      alert(`Error: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm(`Permanently delete Device ID: ${id}?`)) return;
    try {
      await axios.delete(`/api/devices/${id}`);
      await loadAuxiliaryData();
      await loadTelemetryFeed();
    } catch (err) {
      alert('Failed to delete device');
    }
  };

  // Filtered devices
  const filteredDevices = allDevices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.uniqueId?.includes(q) ||
      d.phone?.includes(q) ||
      d.contact?.includes(q)
    );
  });

  const totalPages = Math.ceil(filteredDevices.length / pageSize) || 1;
  const currentDevices = filteredDevices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Available users for dropdown
  const availableUsers = allUsers.filter(u => {
    if (linkedUserIds.includes(u.id)) return false;
    if (!userSearchText) return true;
    const q = userSearchText.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.phone?.includes(q) || u.email?.toLowerCase().includes(q);
  });

  // Available geofences
  const availableGeofences = allGeofences.filter(g => !linkedGeofenceIds.includes(g.id));

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scroll">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Hardware Inventory & Registered Devices</h2>
            <p className="text-xs text-slate-500">Configure vehicle numbers, models, categories, user connections, and attributes</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search devices..."
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-red-600 font-medium"
              />
            </div>
            <button
              onClick={() => openModal('add')}
              className="px-4 py-2 btn-royal-blue rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
              <Plus size={14} /> Add Device
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 min-w-[850px]">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3.5">Vehicle</th>
                  <th className="px-4 py-3.5">Identifier / IMEI</th>
                  <th className="px-4 py-3.5">Model</th>
                  <th className="px-4 py-3.5">SIM Phone</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Driver Contact</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentDevices.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-10 text-slate-400">No devices registered</td></tr>
                ) : (
                  currentDevices.map(dev => (
                    <tr key={dev.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-2.5">
                          <div className="w-10 h-9 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center p-1 shrink-0 shadow-2xs">
                            <VehicleCategoryIcon category={dev.category} model={dev.model} className="w-full h-full object-contain" />
                          </div>
                          <span>{dev.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{dev.uniqueId}</td>
                      <td className="px-4 py-3">{dev.model || 'G11 (5023)'}</td>
                      <td className="px-4 py-3 font-mono">{dev.phone || '--'}</td>
                      <td className="px-4 py-3 capitalize">{dev.category || 'Car'}</td>
                      <td className="px-4 py-3">{dev.contact || dev.attributes?.driverName || '--'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${dev.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {dev.status || 'Offline'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openModal('edit', dev)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition"
                          title="Edit Device"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteDevice(dev.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition ml-1"
                          title="Delete Device"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Showing</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-xs font-semibold focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>units | Total: <strong className="text-slate-900 font-bold">{filteredDevices.length}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white font-bold disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-2 font-mono font-bold text-slate-600">{currentPage} / {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Device Form Modal */}
      {isModalOpen && (
        <div className="modal-backdrop-fixed z-50">
          <div className="modal-sheet-card max-w-4xl h-[92vh] flex flex-col bg-white overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="text-red-600" size={18} />
                <h2 className="text-base font-black text-slate-900">
                  {modalMode === 'edit' ? `Edit Device: ${name}` : 'Register New Device'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <form onSubmit={handleSaveDevice} className="p-5 overflow-y-auto custom-scroll flex-1 space-y-4 bg-slate-50/50">
              {/* Specs Card */}
              <div className="form-card p-4 sm:p-5 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-100 pb-2">
                  Hardware & Vehicle Specifications
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Vehicle Number *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="BR01KG9701"
                      className="w-full form-input font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">IMEI Number *</label>
                    <input
                      type="text"
                      required
                      value={uniqueId}
                      onChange={e => setUniqueId(e.target.value)}
                      placeholder="862607228002708"
                      className="w-full form-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Device SIM Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="5754029176211"
                      className="w-full form-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Device Model</label>
                    <select
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="w-full form-input bg-white font-medium"
                    >
                      {modelsList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Fleet Group</label>
                    <select
                      value={groupId}
                      onChange={e => setGroupId(Number(e.target.value))}
                      className="w-full form-input bg-white font-medium"
                    >
                      <option value="0">None</option>
                      {allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Driver Contact Number</label>
                    <input
                      type="text"
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      placeholder="9135880117"
                      className="w-full form-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Vehicle Category</label>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shrink-0 shadow-2xs">
                        <VehicleCategoryIcon category={category} className="w-full h-full object-contain" />
                      </div>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full form-input bg-white capitalize font-medium"
                      >
                        {categoriesList.map(c => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-600 block mb-1">Device Expiration Date</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={e => setExpiryDate(e.target.value)}
                        className="w-full form-input font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setExpiryDate('')}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl uppercase"
                      >
                        CLEAR
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Connections */}
              <div className="form-card p-4 sm:p-5 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-700 block">User Access Connections</span>
                    <span className="text-[11px] text-slate-500">Only assigned accounts can view or control this device</span>
                  </div>
                  <span className="font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                    {linkedUserIds.length} Connected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Connected chips */}
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 block">Connected User Accounts</label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2.5 border border-slate-200 rounded-xl min-h-[50px] bg-slate-50 max-h-40 overflow-y-auto custom-scroll">
                      {linkedUserIds.length === 0 ? (
                        <span className="text-slate-400">No users connected to this vehicle</span>
                      ) : (
                        linkedUserIds.map(uId => {
                          const u = allUsers.find(item => item.id === uId) || { name: `User #${uId}`, email: '' };
                          return (
                            <span key={uId} className="chip-badge bg-blue-50 text-blue-900 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1.5">
                              <User size={12} className="text-blue-600" />
                              <span className="font-bold">{u.name || u.email}</span>
                              <X
                                size={12}
                                onClick={() => handleUnlinkUser(uId)}
                                className="cursor-pointer text-slate-400 hover:text-red-500 ml-1"
                              />
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Available Search & Add */}
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-700 block">Available Users (Search & Connect)</label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={userSearchText}
                          onChange={e => setUserSearchText(e.target.value)}
                          placeholder="Search users..."
                          className="w-full form-input pl-8 py-1.5 text-xs bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedUserToAdd}
                          onChange={e => setSelectedUserToAdd(e.target.value)}
                          className="w-full form-input py-1.5 bg-white font-medium text-xs"
                        >
                          <option value="">Select User to Link...</option>
                          {availableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.email || u.username})</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleLinkUser}
                          className="px-4 py-1.5 btn-royal-blue rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                        >
                          + Link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Geofences containment zones */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="font-semibold text-slate-700 block mb-1">Linked Geofences (Containment Zones)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 p-2.5 border border-slate-200 rounded-xl min-h-[46px] bg-slate-50 max-h-36 overflow-y-auto custom-scroll">
                      {linkedGeofenceIds.length === 0 ? (
                        <span className="text-slate-400">No boundaries active</span>
                      ) : (
                        linkedGeofenceIds.map(gId => {
                          const g = allGeofences.find(item => item.id === gId) || { name: `Fence #${gId}` };
                          return (
                            <span key={gId} className="chip-badge bg-red-50 text-red-900 border border-red-200 px-2 py-1 rounded-lg flex items-center gap-1.5">
                              <MapPin size={12} className="text-red-500" />
                              <span className="font-bold">{g.name}</span>
                              <X
                                size={12}
                                onClick={() => handleRemoveGeofence(gId)}
                                className="cursor-pointer text-slate-400 hover:text-red-500 ml-1"
                              />
                            </span>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedGeofenceToAdd}
                        onChange={e => setSelectedGeofenceToAdd(e.target.value)}
                        className="w-full form-input py-1.5 bg-white font-medium text-xs"
                      >
                        <option value="">+ Select Geofence to Add...</option>
                        {availableGeofences.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddGeofence}
                        className="px-4 py-1.5 btn-royal-blue rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Attributes */}
              <div className="form-card p-4 sm:p-5 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold uppercase tracking-wider text-slate-700">Custom Attributes & Speed Limits</span>
                  <button
                    type="button"
                    onClick={handleAddAttribute}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1"
                  >
                    <PlusCircle size={13} /> Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {attributesList.map(attr => (
                    <div key={attr.id} className="grid grid-cols-2 gap-2 items-center">
                      <input
                        type="text"
                        value={attr.key}
                        onChange={e => handleAttributeChange(attr.id, 'key', e.target.value)}
                        placeholder="Attribute key"
                        className="form-input text-xs font-medium"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={attr.value}
                          onChange={e => handleAttributeChange(attr.id, 'value', e.target.value)}
                          placeholder="Value"
                          className="w-full form-input text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAttribute(attr.id)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 btn-royal-blue text-white rounded-xl text-xs font-bold uppercase flex items-center gap-2 shadow-md disabled:opacity-60"
                >
                  <Save size={14} />
                  <span>{saving ? 'Saving...' : 'Save Device'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

