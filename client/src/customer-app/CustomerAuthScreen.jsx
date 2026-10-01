import React, { useState } from 'react';
import axios from 'axios';
import { useCustomerTracking } from './CustomerTrackingContext';
import { LogIn, User, Key, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';

export default function CustomerAuthScreen() {
  const { setIsCustomerLoggedOut, refreshData } = useCustomerTracking();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/session', { email, password });
      localStorage.removeItem('abstracker_user_logged_out');
      setIsCustomerLoggedOut(false);
      if (refreshData) {
        await refreshData();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full min-h-[100dvh] bg-gradient-to-b from-blue-50 via-slate-50 to-white flex items-center justify-center p-4 overflow-hidden relative select-none z-50">
      <div className="relative z-10 bg-white/95 backdrop-blur-xl rounded-3xl p-7 sm:p-9 max-w-sm w-full shadow-2xl border border-slate-200/80 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="w-18 h-18 mx-auto rounded-3xl p-1 bg-white shadow-md border border-slate-200/80 flex items-center justify-center overflow-hidden">
            <img src="https://ik.imagekit.io/xgxpgvop9/abstracker.jpg" alt="Logo" className="w-full h-full object-cover rounded-2xl" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-0 text-2xl font-black font-sans tracking-tight py-0.5">
              <span className="text-slate-900">Abs</span>
              <span className="text-red-600">Tracker</span>
            </div>
            <p className="text-[11px] font-bold tracking-wider mt-0.5 uppercase text-amber-600 flex items-center justify-center gap-1.5">
              <Sparkles size={12} className="text-amber-500 animate-pulse" />
              <span>Unconditional Aftersales Service</span>
              <Sparkles size={12} className="text-amber-500 animate-pulse" />
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Username / Vehicle ID</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User size={16} />
              </span>
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition" 
                placeholder="Enter username" 
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Key size={16} />
              </span>
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-10 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition" 
                placeholder="Enter password" 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 disabled:opacity-60 cursor-pointer mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            <span>{loading ? 'Authenticating...' : 'Sign In to AbsTracker'}</span>
          </button>
        </form>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 text-center font-bold">
            {error}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 text-center flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Powered by</span>
            <span className="font-black text-slate-800 text-xs tracking-wide">
              Abstracker Team
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
