import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, ShieldCheck, LogOut, RefreshCw, Zap } from 'lucide-react';

export const Header = ({ title, subtitle, onOpenRequestModal }) => {
  const { currentUser, users, switchUser, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          {title || "Dashboard Overview"}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5 font-medium">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Access Check Modal Trigger Button */}
        {onOpenRequestModal && (
          <button
            onClick={onOpenRequestModal}
            className="vault-btn vault-btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <Zap size={14} className="text-amber-400 fill-amber-400/20" />
            Test Access Engine
          </button>
        )}

        {/* User Switcher Dropdown for Demo Presenters */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5 pl-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs">
              {currentUser ? currentUser.name.substring(0, 2).toUpperCase() : 'US'}
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {currentUser ? currentUser.name : 'Guest'}
              </div>
              <div className="text-[10px] text-cyan-400 font-medium">
                {currentUser ? currentUser.role : 'Visitor'}
              </div>
            </div>
          </div>

          <select
            value={currentUser ? currentUser.id : ''}
            onChange={(e) => switchUser(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 text-xs text-slate-300 rounded px-2 py-1 outline-none cursor-pointer focus:border-blue-500"
            title="Switch User Role for Demo"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                Switch to: {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-800 transition-colors"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};

export default Header;
