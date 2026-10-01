import React, { useState } from 'react';
import axios from 'axios';
import { useFleet } from '../contexts/FleetContext';
import { UserPlus, Search, Edit, Trash2, X, User, Truck, Bell, PlusCircle, Eye, EyeOff, Save, ShieldCheck } from 'lucide-react';

const EVENT_TYPE_DICTIONARY = {
  deviceOnline: 'Device Online (Active)',
  deviceOffline: 'Device Offline (No Signal)',
  deviceMoving: 'Vehicle Moving',
  deviceStopped: 'Vehicle Stopped',
  deviceOverspeed: 'Overspeed Alert',
  ignitionOn: 'Ignition Turned ON',
  ignitionOff: 'Ignition Turned OFF',
  geofenceEnter: 'Geofence Entered',
  geofenceExit: 'Geofence Exited',
  alarm: 'SOS / Emergency Alarm',
  commandResult: 'Command Acknowledged'
};

export default function UsersDirectory() {
  const { allUsers, allDevices, loadAuxiliaryData } = useFleet();

  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [deviceLimit, setDeviceLimit] = useState(10);
  const [isAdmin, setIsAdmin] = useState(false);

  // Assigned Devices & Notifications
  const [assignedDeviceIds, setAssignedDeviceIds] = useState([]);
  const [selectedDeviceToAdd, setSelectedDeviceToAdd] = useState('');
  const [subscribedNotifications, setSubscribedNotifications] = useState(['ignitionOn', 'deviceOverspeed']);
  const [selectedNotificationToAdd, setSelectedNotificationToAdd] = useState('');

  // Attributes
  const [attributesList, setAttributesList] = useState([]);

  const openModal = async (mode, user = null) => {
    setModalMode(mode);
    setShowPassword(false);

    if (mode === 'edit' && user) {
      setUserId(user.id);
      setName(user.name || '');
      setUsername(user.username || user.email || '');
      setEmail(user.email || '');
      setPassword('');
      setPhone(user.phone || '');
      setDeviceLimit(user.deviceLimit ?? 10);
      setIsAdmin(!!user.administrator);

      if (user.expirationTime) {
        setExpiryDate(user.expirationTime.split('T')[0]);
      } else {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        setExpiryDate(d.toISOString().split('T')[0]);
      }

      // Attributes
      const attrs = user.attributes || {};
      const attrRows = [];
      Object.keys(attrs).forEach(k => {
        if (k !== 'notificationTypes') {
          attrRows.push({ id: Math.random().toString(), key: k, value: String(attrs[k]) });
        }
      });
      if (attrRows.length === 0) {
        attrRows.push({ id: '1', key: 'speedUnit', value: attrs.speedUnit || 'kmh' });
        attrRows.push({ id: '2', key: 'timezone', value: attrs.timezone || 'Asia/Kolkata' });
      }
      setAttributesList(attrRows);

      // Notifications
      if (Array.isArray(attrs.notificationTypes)) {
        setSubscribedNotifications([...attrs.notificationTypes]);
      } else {
        setSubscribedNotifications(['ignitionOn', 'deviceOverspeed']);
      }

      // Assigned Devices
      try {
        const res = await axios.get(`/api/devices?userId=${user.id}`);
        if (Array.isArray(res.data)) {
          setAssignedDeviceIds(res.data.map(d => d.id));
        } else {
          setAssignedDeviceIds([]);
        }
      } catch (e) {
        setAssignedDeviceIds([]);
      }
    } else {
      setUserId('');
      setName('');
      setUsername('');
      setEmail('');
      setPassword('123456');
      setPhone('');
      const defaultExp = new Date();
      defaultExp.setFullYear(defaultExp.getFullYear() + 1);
      setExpiryDate(defaultExp.toISOString().split('T')[0]);
      setDeviceLimit(10);
      setIsAdmin(false);
      setAssignedDeviceIds([]);
      setSubscribedNotifications(['ignitionOn', 'deviceOverspeed']);
      setAttributesList([
        { id: '1', key: 'speedUnit', value: 'kmh' },
        { id: '2', key: 'timezone', value: 'Asia/Kolkata' }
      ]);
    }

    setSelectedDeviceToAdd('');
    setSelectedNotificationToAdd('');
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

  // Device linking
  const handleAssignDevice = async () => {
    const dId = parseInt(selectedDeviceToAdd);
    if (!dId || assignedDeviceIds.includes(dId)) return;
    setAssignedDeviceIds(prev => [...prev, dId]);
    setSelectedDeviceToAdd('');

    if (modalMode === 'edit' && userId) {
      await axios.post('/api/permissions', { userId, deviceId: dId }).catch(() => {});
    }
  };

  const handleUnassignDevice = async (dId) => {
    setAssignedDeviceIds(prev => prev.filter(id => id !== dId));
    if (modalMode === 'edit' && userId) {
      await axios.delete('/api/permissions', { data: { userId, deviceId: dId } }).catch(() => {});
    }
  };

  // Notification linking
  const handleAddNotification = () => {
    if (!selectedNotificationToAdd || subscribedNotifications.includes(selectedNotificationToAdd)) return;
    setSubscribedNotifications(prev => [...prev, selectedNotificationToAdd]);
    setSelectedNotificationToAdd('');
  };

  const handleRemoveNotification = (type) => {
    setSubscribedNotifications(prev => prev.filter(t => t !== type));
  };

  // Save User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      alert('Customer Name and Username are required.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
    if (!cleanUsername) {
      alert('Please enter a valid alphanumeric username.');
      return;
    }

    setSaving(true);
    const attributes = {};
    attributesList.forEach(a => {
      const k = a.key.trim();
      const v = a.value.trim();
      if (k) attributes[k] = v;
    });
    attributes.notificationTypes = subscribedNotifications;

    const userEmail = (email.trim() || (cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@fleet.local`)).toLowerCase();

    const payload = {
      name: name.trim(),
      username: cleanUsername,
      email: userEmail,
      phone: phone.trim(),
      deviceLimit: parseInt(deviceLimit) || 10,
      administrator: isAdmin,
      attributes
    };

    if (expiryDate) {
      payload.expirationTime = new Date(expiryDate).toISOString();
    } else {
      const defaultExp = new Date();
      defaultExp.setFullYear(defaultExp.getFullYear() + 1);
      payload.expirationTime = defaultExp.toISOString();
    }

    if (password && password.trim()) {
      payload.password = password.trim();
    } else if (modalMode === 'add') {
      payload.password = '123456';
    }

    try {
      let savedUser;
      if (modalMode === 'edit' && userId) {
        payload.id = parseInt(userId);
        const res = await axios.put(`/api/users/${userId}`, payload);
        savedUser = res.data;
      } else {
        const res = await axios.post('/api/users', payload);
        savedUser = res.data;
        if (savedUser?.id && assignedDeviceIds.length > 0) {
          for (const dId of assignedDeviceIds) {
            await axios.post('/api/permissions', { userId: savedUser.id, deviceId: dId }).catch(() => {});
          }
        }
      }

      await loadAuxiliaryData();
      setIsModalOpen(false);
    } catch (err) {
      const errData = err.response?.data;
      let errMsg = 'Could not save user profile.';
      if (typeof errData === 'string') {
        if (errData.includes('already exist into the system') || errData.includes('UniqueFieldUtils') || errData.includes('already exist')) {
          errMsg = 'This username is already taken. Please choose a different unique username.';
        } else if (errData.includes('User Expiry extends your expiry date')) {
          errMsg = 'User expiry date cannot exceed master account validity.';
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

  const handleDeleteUser = async (id) => {
    if (!window.confirm(`Permanently remove User ID: ${id}?`)) return;
    try {
      await axios.delete(`/api/users/${id}`);
      await loadAuxiliaryData();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  // Filtered users
  const filteredUsers = allUsers.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      String(u.id).includes(q)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const currentUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Available devices
  const availableDevices = allDevices.filter(d => !assignedDeviceIds.includes(d.id));

  // Available notification types
  const availableNotificationTypes = Object.keys(EVENT_TYPE_DICTIONARY).filter(t => !subscribedNotifications.includes(t));

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scroll">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">User Access Directory & Roles</h2>
            <p className="text-xs text-slate-500">Manage client accounts, device quotas, administrative permissions, and notification triggers</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search accounts..."
                className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-red-600 font-medium"
              />
            </div>
            <button
              onClick={() => openModal('add')}
              className="px-4 py-2 btn-royal-blue rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm whitespace-nowrap"
            >
              <UserPlus size={14} /> Create User
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 min-w-[850px]">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3.5">Customer Name</th>
                  <th className="px-4 py-3.5">Username / Email</th>
                  <th className="px-4 py-3.5">Mobile Phone</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Device Limit</th>
                  <th className="px-4 py-3.5">Expiration</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentUsers.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-10 text-slate-400">No registered user accounts</td></tr>
                ) : (
                  currentUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <User size={14} />
                          </div>
                          <span>{u.name || 'Unnamed'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{u.email || u.username}</td>
                      <td className="px-4 py-3 font-mono">{u.phone || '--'}</td>
                      <td className="px-4 py-3">
                        {u.administrator ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <ShieldCheck size={11} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                            Customer
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">
                        {u.deviceLimit === -1 ? 'Unlimited' : (u.deviceLimit ?? 10)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {u.expirationTime ? new Date(u.expirationTime).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openModal('edit', u)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition"
                          title="Edit User"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition ml-1"
                          title="Delete User"
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
              <span>accounts | Total: <strong className="text-slate-900 font-bold">{filteredUsers.length}</strong></span>
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

      {/* User Form Modal */}
      {isModalOpen && (
        <div className="modal-backdrop-fixed z-50">
          <div className="modal-sheet-card max-w-4xl h-[92vh] flex flex-col bg-white overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <User className="text-red-600" size={18} />
                <h2 className="text-base font-black text-slate-900">
                  {modalMode === 'edit' ? `Edit User: ${name}` : 'Register New Client User'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <form onSubmit={handleSaveUser} className="p-5 overflow-y-auto custom-scroll flex-1 space-y-4 bg-slate-50/50">
              {/* Credentials Card */}
              <div className="form-card p-4 sm:p-5 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-100 pb-2">
                  User Profile & Access Credentials
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                  <div className="md:col-span-2">
                    <label className="font-semibold text-slate-600 block mb-1">Customer / Company Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Nikhil Kumar"
                      className="w-full form-input font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Username * (Alphanumeric)</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="nikhil6118"
                      className="w-full form-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={modalMode === 'edit' ? '(Unchanged)' : '••••••••'}
                        className="w-full form-input pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Customer Mobile Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="8240268590"
                      className="w-full form-input font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="font-semibold text-slate-600 block mb-1">Customer Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="client@fleet.local"
                      className="w-full form-input font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Account Expiration Date</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={e => setExpiryDate(e.target.value)}
                      className="w-full form-input font-mono font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Device Quota Limit</label>
                    <input
                      type="number"
                      value={deviceLimit}
                      onChange={e => setDeviceLimit(Number(e.target.value))}
                      className="w-full form-input font-mono font-bold"
                    />
                  </div>

                  <div className="md:col-span-3 flex items-center gap-3 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={isAdmin}
                        onChange={e => setIsAdmin(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                      />
                      <span>Administrator Permissions</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Vehicle Assignments & Alert Triggers */}
              <div className="form-card p-4 sm:p-5 space-y-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold uppercase tracking-wider text-slate-700">Vehicle Assignments & Alert Triggers</span>
                  <span className="text-[11px] text-slate-400">Configure device visibility and notification subscriptions</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Vehicle assignments */}
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-600 block">Assigned Fleet Vehicles</label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2.5 border border-slate-200 rounded-xl min-h-[48px] bg-slate-50 max-h-36 overflow-y-auto custom-scroll">
                      {assignedDeviceIds.length === 0 ? (
                        <span className="text-slate-400">No vehicles linked</span>
                      ) : (
                        assignedDeviceIds.map(dId => {
                          const d = allDevices.find(item => item.id === dId) || { name: `Device #${dId}` };
                          return (
                            <span key={dId} className="chip-badge bg-blue-50 text-blue-900 border border-blue-200 px-2 py-1 rounded-lg flex items-center gap-1.5">
                              <Truck size={12} className="text-blue-600" />
                              <span className="font-bold">{d.name}</span>
                              <X
                                size={12}
                                onClick={() => handleUnassignDevice(dId)}
                                className="cursor-pointer text-slate-400 hover:text-red-500 ml-1"
                              />
                            </span>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={selectedDeviceToAdd}
                        onChange={e => setSelectedDeviceToAdd(e.target.value)}
                        className="w-full form-input py-1.5 bg-white font-medium text-xs"
                      >
                        <option value="">+ Select Vehicle to Assign...</option>
                        {availableDevices.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.uniqueId})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAssignDevice}
                        className="px-4 py-1.5 btn-royal-blue rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                      >
                        Assign
                      </button>
                    </div>
                  </div>

                  {/* Notification Events */}
                  <div className="space-y-2">
                    <label className="font-semibold text-slate-600 block">Notification Events</label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2.5 border border-slate-200 rounded-xl min-h-[48px] bg-slate-50 max-h-36 overflow-y-auto custom-scroll">
                      {subscribedNotifications.length === 0 ? (
                        <span className="text-slate-400">No alerts subscribed</span>
                      ) : (
                        subscribedNotifications.map(type => (
                          <span key={type} className="chip-badge bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1 rounded-lg flex items-center gap-1.5">
                            <Bell size={12} className="text-amber-500" />
                            <span className="font-bold">{EVENT_TYPE_DICTIONARY[type] || type}</span>
                            <X
                              size={12}
                              onClick={() => handleRemoveNotification(type)}
                              className="cursor-pointer text-slate-400 hover:text-red-500 ml-1"
                            />
                          </span>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={selectedNotificationToAdd}
                        onChange={e => setSelectedNotificationToAdd(e.target.value)}
                        className="w-full form-input py-1.5 bg-white font-medium text-xs"
                      >
                        <option value="">+ Add Event Alert...</option>
                        {availableNotificationTypes.map(t => (
                          <option key={t} value={t}>{EVENT_TYPE_DICTIONARY[t]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddNotification}
                        className="px-4 py-1.5 btn-royal-blue rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                      >
                        Add Alert
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Preferences (Attributes) */}
              <div className="form-card p-4 sm:p-5 space-y-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold uppercase tracking-wider text-slate-700">Account Preferences</span>
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
                  <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
