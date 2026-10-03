import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, ArrowRight, UserCheck, KeyRound } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@examvault.local');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(email, password)) {
      navigate('/');
    }
  };

  const handleQuickLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('admin123');
    if (login(demoEmail, 'admin123')) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="vault-card w-full max-w-md p-8 border border-slate-800/80 vault-glow-blue relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex p-3.5 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-2xl shadow-xl shadow-blue-500/25 text-white mb-3">
            <Shield size={36} className="stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Exam<span className="text-blue-500">Vault</span>
          </h1>
          <p className="text-xs uppercase font-bold tracking-widest text-cyan-400 mt-1">
            Cybersecurity Prototype
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Secure Examination Document Lifecycle Management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="vault-input"
              placeholder="admin@examvault.local"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="vault-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="vault-btn vault-btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2 text-sm font-bold"
          >
            <span>Sign In to Vault</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons for Presentation */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <p className="text-[11px] uppercase font-bold text-slate-400 mb-2.5 text-center tracking-wider">
            Fast Prototype Login Options:
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleQuickLogin('admin@examvault.local')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-blue-400" />
                <span className="font-semibold text-white">System Admin</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">Administrator</span>
            </button>

            <button
              onClick={() => handleQuickLogin('priya.sharma@university.edu')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-emerald-400" />
                <span className="font-semibold text-white">Dr. Priya Sharma</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Exam Coordinator</span>
            </button>

            <button
              onClick={() => handleQuickLogin('akash.g@university.edu')}
              className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck size={14} className="text-amber-400" />
                <span className="font-semibold text-white">Akash G</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono">Staff</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
