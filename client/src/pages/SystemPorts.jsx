import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  Server, CreditCard, Search, Copy, Check, Radio, ShieldCheck, Zap, 
  ArrowUpRight, Sparkles, RefreshCw, Layers, Calculator, CheckCircle2, 
  Sliders, X, ChevronRight, QrCode, Lock, Coins
} from 'lucide-react';

export default function SystemPorts() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('billing'); // Default to billing since user wants billing coin page

  // Ports State
  const [portsList, setPortsList] = useState([]);
  const [portSearch, setPortSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [loadingPorts, setLoadingPorts] = useState(true);

  // Billing State
  const [pointsBalance, setPointsBalance] = useState(0);
  const [revivalPoints, setRevivalPoints] = useState(25);
  const [maidenPoints, setMaidenPoints] = useState(11);
  const [rechargeOptions, setRechargeOptions] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [customCoins, setCustomCoins] = useState('');
  const [isCrediting, setIsCrediting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  // Fleet Draw Estimator
  const [fleetSize, setFleetSize] = useState(10);

  // Invoices list state
  const [invoices, setInvoices] = useState([
    { id: 'TXN-90238120', date: '01/09/2026', title: 'Fleet Points Allocation - 500 Credits', points: 500, amount: 72500, status: 'SUCCESS' },
    { id: 'TXN-88410294', date: '15/08/2026', title: 'Fleet Points Allocation - 100 Credits', points: 100, amount: 13500, status: 'SUCCESS' }
  ]);

  useEffect(() => {
    fetchPorts();
    fetchBilling();
  }, [user]);

  const fetchPorts = async () => {
    setLoadingPorts(true);
    try {
      // Check metadata first
      const metaRes = await axios.get('/api/custom/metadata').catch(() => null);
      if (metaRes?.data?.supportedPorts && Array.isArray(metaRes.data.supportedPorts) && metaRes.data.supportedPorts.length > 0) {
        setPortsList(metaRes.data.supportedPorts);
      } else {
        const portRes = await axios.get('/api/server/supportedPorts');
        if (Array.isArray(portRes.data)) {
          setPortsList(portRes.data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPorts(false);
    }
  };

  const fetchBilling = async () => {
    setLoadingBilling(true);
    try {
      setLoadingBilling(true);
      const sessionRes = await axios.get('/api/session').catch(() => null);
      const sessionUser = sessionRes?.data || user || {};
      
      const exactPoints = sessionUser.devicePoints !== undefined ? sessionUser.devicePoints : (user?.devicePoints ?? 0);
      setPointsBalance(exactPoints);
      setRevivalPoints(sessionUser.userRevivalPoints ?? user?.userRevivalPoints ?? 25);
      setMaidenPoints(sessionUser.userMaidenPoints ?? user?.userMaidenPoints ?? 11);

      const res = await axios.get('/api/users/getPointsRechargeOptions?pointType=DEVICE_POINTS').catch(() => null);
      const data = res?.data || {};
      const ratesList = data.pointRateList || data.rechargeOptions || [];
      if (Array.isArray(ratesList) && ratesList.length > 0) {
        setRechargeOptions(ratesList);
      }
    } catch (e) {
      console.error(e);
      setPointsBalance(user?.devicePoints ?? 0);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleCopyCommand = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Direct Admin Coin Top-Up
  const handleDirectCreditCoins = async (coinsToAdd, packTitle = 'Admin Direct Top-Up') => {
    const qty = parseInt(coinsToAdd, 10);
    if (!qty || qty <= 0) {
      alert('Please enter a valid coin amount greater than 0');
      return;
    }
    setIsCrediting(true);
    try {
      const res = await axios.post('/api/users/rechargePoints', {
        points: qty,
        userId: user?.id
      });
      const newBal = res.data?.currentBalance ?? (pointsBalance + qty);
      const newRevival = res.data?.userRevivalPoints ?? (revivalPoints + qty);
      setPointsBalance(newBal);
      setRevivalPoints(newRevival);
      if (user) {
        user.devicePoints = newBal;
        user.userRevivalPoints = newRevival;
      }
      const newTxn = {
        id: `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        date: new Date().toLocaleDateString('en-IN'),
        title: `${packTitle} (+${qty} Coins)`,
        points: qty,
        amount: 0,
        status: 'SUCCESS'
      };
      setInvoices(prev => [newTxn, ...prev]);
      setPaymentSuccess(`Coins Credited Successfully! +${qty.toLocaleString()} Coins added directly.`);
      setCustomCoins('');
      fetchBilling();
      setTimeout(() => setPaymentSuccess(null), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to credit coins');
    } finally {
      setIsCrediting(false);
    }
  };

  // Filtered ports with category pills & search
  const filteredPorts = portsList.filter(p => {
    const q = portSearch.toLowerCase();
    const name = (p.name || p.protocol || '').toLowerCase();
    const portStr = String(p.port || '');
    const cmdStr = (p.attributes?.serverCmd || '').toLowerCase();

    const matchesSearch = !portSearch || name.includes(q) || portStr.includes(q) || cmdStr.includes(q);

    let matchesCategory = true;
    if (selectedCategory === 'standard') {
      matchesCategory = name.includes('standard') || name.includes('140') || cmdStr.includes('watsoo');
    } else if (selectedCategory === 'gt06') {
      matchesCategory = name.includes('gt06') || name.includes('concox') || portStr === '5023';
    } else if (selectedCategory === 'teltonika') {
      matchesCategory = name.includes('teltonika') || portStr === '5027';
    } else if (selectedCategory === 'wetrack') {
      matchesCategory = name.includes('wetrack') || portStr === '5013';
    } else if (selectedCategory === 'obd') {
      matchesCategory = name.includes('obd') || name.includes('x1') || name.includes('w15');
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scroll">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Hardware Protocols & Enterprise Billing</h2>
            <p className="text-xs text-slate-500">Live Traccar gateway port listeners, tracker SMS commands, and points balance</p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-bold">
            <button
              onClick={() => setActiveTab('ports')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'ports' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Server size={14} className="text-red-600" />
              <span>Supported Ports & Protocols</span>
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'billing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <CreditCard size={14} className="text-emerald-600" />
              <span>Billing & Device Points</span>
            </button>
          </div>
        </div>

        {/* Payment Success Toast */}
        {paymentSuccess && (
          <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <span>{paymentSuccess}</span>
            </div>
            <button onClick={() => setPaymentSuccess(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* TAB 1: PORTS DIRECTORY */}
        {activeTab === 'ports' && (
          <div className="space-y-4">
            
            {/* Search & Category Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={portSearch}
                      onChange={e => setPortSearch(e.target.value)}
                      placeholder="Search by protocol, port, or tracker name..."
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-red-600 font-medium w-64 sm:w-80"
                    />
                  </div>
                  {portSearch && (
                    <button
                      onClick={() => setPortSearch('')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                    {filteredPorts.length} Active Listeners
                  </span>
                  <button
                    onClick={fetchPorts}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                    title="Refresh Ports"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Protocol Category Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categories:</span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-xl font-bold transition ${selectedCategory === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  All ({portsList.length})
                </button>
                <button
                  onClick={() => setSelectedCategory('standard')}
                  className={`px-3 py-1 rounded-xl font-bold transition ${selectedCategory === 'standard' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Standard Trackers
                </button>
                <button
                  onClick={() => setSelectedCategory('gt06')}
                  className={`px-3 py-1 rounded-xl font-bold transition ${selectedCategory === 'gt06' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Concox / GT06
                </button>
                <button
                  onClick={() => setSelectedCategory('teltonika')}
                  className={`px-3 py-1 rounded-xl font-bold transition ${selectedCategory === 'teltonika' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Teltonika
                </button>
                <button
                  onClick={() => setSelectedCategory('wetrack')}
                  className={`px-3 py-1 rounded-xl font-bold transition ${selectedCategory === 'wetrack' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  WeTrack
                </button>
                <button
                  onClick={() => setSelectedCategory('obd')}
                  className={`px-3 py-1 rounded-xl font-bold transition ${selectedCategory === 'obd' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  OBD II
                </button>
              </div>
            </div>

            {/* Ports Grid */}
            {loadingPorts ? (
              <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <div className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></span>
                  <span>Fetching remote gateway listener specifications...</span>
                </div>
              </div>
            ) : filteredPorts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                No matching hardware protocols found for current filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredPorts.map((p, idx) => {
                  const id = p.id || idx;
                  const name = p.name || p.protocol || 'Hardware Protocol';
                  const port = p.port || 5023;
                  const attrs = p.attributes || {};
                  const serverCmd = attrs.serverCmd;
                  const paramCmd = attrs.paramCmd;
                  const statusCmd = attrs.statusCmd;
                  const apnCmd = attrs.apnCmd;

                  return (
                    <div
                      key={id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{name}</h3>
                            <span className="text-[10px] text-slate-400 font-mono">ID: #{p.id || '--'} • TCP/UDP</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 font-mono font-black text-xs border border-red-200 flex-shrink-0">
                            PORT {port}
                          </span>
                        </div>

                        {serverCmd && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Server Config Command:
                            </span>
                            <div className="flex items-center justify-between bg-slate-900 text-emerald-400 p-2 rounded-xl text-[11px] font-mono border border-slate-800">
                              <span className="truncate mr-2 select-all">{serverCmd}</span>
                              <button
                                onClick={() => handleCopyCommand(serverCmd, `server-${id}`)}
                                className="text-slate-400 hover:text-white p-1 rounded transition flex-shrink-0"
                                title="Copy SMS string"
                              >
                                {copiedId === `server-${id}` ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Additional Command Hints */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {apnCmd && (
                            <span
                              onClick={() => handleCopyCommand(apnCmd, `apn-${id}`)}
                              className="cursor-pointer text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-md font-medium"
                              title="Click to copy APN command"
                            >
                              APN: {apnCmd}
                            </span>
                          )}
                          {paramCmd && (
                            <span
                              onClick={() => handleCopyCommand(paramCmd, `param-${id}`)}
                              className="cursor-pointer text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-md font-medium"
                              title="Click to copy param query command"
                            >
                              PARAM: {paramCmd}
                            </span>
                          )}
                          {statusCmd && (
                            <span
                              onClick={() => handleCopyCommand(statusCmd, `status-${id}`)}
                              className="cursor-pointer text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-md font-medium"
                              title="Click to copy status query command"
                            >
                              STATUS: {statusCmd}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <Radio size={11} className="animate-pulse" /> Listening
                        </span>
                        <span className="font-mono text-[10px]">Host: 174.138.120.156</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BILLING & DEVICE POINTS */}
        {activeTab === 'billing' && (
          <div className="space-y-5">
            {/* Wallet Overview Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Digital Wallet Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-black p-6 rounded-2xl text-white shadow-xl flex flex-col justify-between space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Device Points Wallet</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck size={12} /> Active & Funded
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tracking-tight text-white">
                      {pointsBalance} <span className="text-sm font-sans font-medium text-slate-400">Device Coins</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Primary Tracking Credits (1 Point = 1 Day / Device)</p>
                  
                  {/* Secondary Point Sub-Ledgers directly from server */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px] font-mono">
                    <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 block text-[9px] uppercase">User Maiden Points</span>
                      <strong className="text-emerald-400 text-xs">{maidenPoints} PTS</strong>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 block text-[9px] uppercase">User Revival Points</span>
                      <strong className="text-blue-400 text-xs">{revivalPoints} PTS</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Account ID: #{user?.id || 29350}</span>
                  <span className="text-white font-bold">{user?.name || user?.username}</span>
                </div>
              </div>

              {/* Interactive Fleet Estimator */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fleet Estimator</span>
                  <Calculator size={16} className="text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>Fleet Size:</span>
                    <span className="font-mono text-blue-600">{fleetSize} Vehicles</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={fleetSize}
                    onChange={e => setFleetSize(Number(e.target.value))}
                    className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Monthly Requirement:</span>
                  <strong className="text-slate-900 font-mono font-bold">{fleetSize * 30} Points / month</strong>
                </div>
              </div>

              {/* Account Tier Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Classification</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-200">
                      {user?.distributor ? 'DISTRIBUTOR' : 'STANDARD'}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-1">{user?.name || 'ABS Tracker'}</h3>
                  <div className="space-y-1 mt-2 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Device Quota:</span>
                      <strong className="font-mono text-slate-900">{user?.deviceLimit || 5000} Units</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Billing Model:</span>
                      <strong className="text-emerald-600">Prepaid Wallet</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Server Host:</span>
                      <strong className="font-mono text-slate-500">174.138.120.156</strong>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => alert('Enterprise Support Line: +91 9135880117 / Telematics Gateway Engine')}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Contact Billing Support</span>
                </button>
              </div>
            </div>

            {/* Direct Admin Coin Top-Up Panel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Coins className="text-amber-500" size={18} />
                    <span>Direct Admin Coin Top-Up</span>
                  </h3>
                  <p className="text-xs text-slate-500">Instantly credit coins directly to your balance without payment processing</p>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                  <span>Current:</span>
                  <strong className="text-amber-950 font-black">{pointsBalance.toLocaleString()} COINS</strong>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Quick Credit Presets:</label>
                <div className="flex flex-wrap items-center gap-2">
                  {[10, 25, 50, 100, 250, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      disabled={isCrediting}
                      onClick={() => handleDirectCreditCoins(amt, `Quick Preset +${amt}`)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-200 disabled:opacity-50"
                    >
                      <span>+{amt}</span>
                      <span className="text-[10px] text-slate-500">Coins</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input & Credit Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input
                    type="number"
                    min="1"
                    value={customCoins}
                    onChange={e => setCustomCoins(e.target.value)}
                    placeholder="Enter custom coin amount (e.g. 50, 200, 750)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-600"
                  />
                </div>
                <button
                  type="button"
                  disabled={isCrediting || !customCoins}
                  onClick={() => handleDirectCreditCoins(customCoins, 'Custom Admin Top-Up')}
                  className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  <Zap size={14} />
                  <span>{isCrediting ? 'Crediting Coins...' : 'Credit Coins Directly'}</span>
                </button>
              </div>
            </div>

            {/* Official Recharge Options Packs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">Configured Credit Packs</h3>
                  <p className="text-xs text-slate-500">Click any pack to instantly add points directly to account</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
                  {rechargeOptions.length} Available Packs
                </span>
              </div>

              {loadingBilling ? (
                <div className="p-12 text-center text-slate-400">Loading credit packs...</div>
              ) : rechargeOptions.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No active recharge options configured.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {rechargeOptions.map(plan => {
                    const isPopular = plan.quantity === 50 || plan.quantity === 100;

                    return (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-2xl border transition relative flex flex-col justify-between space-y-3 ${isPopular ? 'border-amber-400 bg-amber-50/20 shadow-sm' : 'border-slate-200 bg-white shadow-xs hover:border-slate-300'}`}
                      >
                        {isPopular && (
                          <span className="absolute -top-2.5 right-4 bg-amber-500 text-white font-bold text-[9px] uppercase px-2 py-0.5 rounded-full shadow-xs">
                            Standard Tier
                          </span>
                        )}

                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 text-sm">{plan.title}</h4>
                            <span className="text-xs font-mono font-bold text-slate-400">#{plan.code}</span>
                          </div>

                          <div className="mt-2">
                            <span className="text-2xl font-black text-slate-900">+{plan.quantity}</span>
                            <span className="text-xs font-bold text-amber-600 ml-1">Coins</span>
                          </div>

                          <div className="text-[11px] text-slate-500 font-medium mt-1">
                            Standard unit value: ₹{plan.rate} / point
                          </div>
                        </div>

                        <button
                          disabled={isCrediting}
                          onClick={() => handleDirectCreditCoins(plan.quantity, plan.title)}
                          className="w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs bg-slate-900 hover:bg-black text-white disabled:opacity-50"
                        >
                          <Zap size={13} className="text-amber-400" />
                          <span>Add +{plan.quantity} Coins Directly</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Invoices / Receipts Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Credit Allocation History</span>
                <span className="text-[11px] text-slate-500 font-mono">Instant updates</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Credits Added</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-mono text-slate-600">{inv.id}</td>
                        <td className="px-4 py-3">{inv.date}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{inv.title}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-600">+{inv.points} PTS</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}


