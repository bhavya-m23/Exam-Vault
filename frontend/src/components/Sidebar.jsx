import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  FileText, 
  Lock, 
  ShieldAlert, 
  Activity,
  Server,
  KeyRound,
  Database
} from 'lucide-react';

export const Sidebar = () => {
  const location = useLocation();
  const [activeAlertsCount, setActiveAlertsCount] = useState(2);
  const [backendStatus, setBackendStatus] = useState("Connected");

  useEffect(() => {
    // Fetch live alert stats from backend
    fetch('/api/security/stats')
      .then(res => res.json())
      .then(data => {
        if (data && data.activeAlerts !== undefined) {
          setActiveAlertsCount(data.activeAlerts);
        }
      })
      .catch(() => setBackendStatus("Offline"));
  }, [location.pathname]);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Documents', path: '/documents', icon: FileText },
    { label: 'Access Policies', path: '/policies', icon: Lock },
    { 
      label: 'Security Activity', 
      path: '/security', 
      icon: ShieldAlert,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null
    },
    { label: 'Audit Logs', path: '/audit', icon: Activity },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Shield size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white font-sans flex items-center gap-1">
                Exam<span className="text-blue-500">Vault</span>
              </h1>
              <p className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                Cyber Vault Prototype
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5 leading-snug font-medium">
            Secure Examination Document Lifecycle Management
          </p>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer Widget */}
      <div className="p-4 m-3 bg-slate-900/90 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-between font-bold text-slate-300 text-[11px] uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Server size={13} className="text-emerald-400" />
            System Status
          </span>
          <span className={`inline-block w-2 h-2 rounded-full ${backendStatus === "Connected" ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex items-center justify-between text-slate-400">
            <span>Backend Server:</span>
            <span className={backendStatus === "Connected" ? 'text-emerald-400 font-medium' : 'text-red-400'}>
              {backendStatus === "Connected" ? 'localhost:5000' : 'Disconnected'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <KeyRound size={11} className="text-cyan-400" /> Fingerprint Engine:
            </span>
            <span className="text-cyan-400 font-mono">SHA-256</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <Database size={11} className="text-purple-400" /> Data Store:
            </span>
            <span className="text-purple-300 font-mono text-[10px]">In-Memory JS</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
