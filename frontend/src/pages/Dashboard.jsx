import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import RequestAccessModal from '../components/RequestAccessModal';
import { 
  FileText, 
  Lock, 
  ShieldAlert, 
  CheckCircle2, 
  Activity, 
  Zap, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const [stats, setStats] = useState({
    protectedDocuments: 12,
    activePolicies: 8,
    blockedAttempts: 7,
    activeAlerts: 2,
    integrityPercentage: "98.7%"
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, auditRes, secRes] = await Promise.all([
        fetch('/api/security/stats'),
        fetch('/api/audit'),
        fetch('/api/security/events')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setRecentLogs(auditData.slice(0, 5));
      }
      if (secRes.ok) {
        const secData = await secRes.json();
        setSecurityEvents(secData.slice(0, 3));
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Quick Demo Scenario 1 Trigger: Akash G (Staff) -> Computer Networks -> BLOCKED
  const runDemoScenario1 = async () => {
    try {
      const res = await fetch('/api/access/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'USR-003', // Akash G
          documentId: 'DOC-002', // Computer Networks
          action: 'VIEW',
          purpose: 'Exam Preparation'
        })
      });
      const data = await res.json();
      showToast(`DEMO SCENARIO 1 EXECUTED: ${data.reason}`, 'danger');
      fetchDashboardData();
    } catch (err) {
      showToast('Error running demo scenario 1', 'danger');
    }
  };

  // Quick Demo Scenario 2 Trigger: Dr. Priya Sharma (Exam Coordinator) -> Data Structures -> ALLOWED
  const runDemoScenario2 = async () => {
    try {
      const res = await fetch('/api/access/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'USR-002', // Dr. Priya Sharma
          documentId: 'DOC-001', // Data Structures
          action: 'VIEW',
          purpose: 'Exam Preparation'
        })
      });
      const data = await res.json();
      showToast(`DEMO SCENARIO 2 EXECUTED: ${data.reason}`, 'success');
      fetchDashboardData();
    } catch (err) {
      showToast('Error running demo scenario 2', 'danger');
    }
  };

  return (
    <div className="flex-1 min-w-0 pb-12">
      <Header
        title="Security Overview"
        subtitle="Monitor and protect examination documents"
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Hackathon Demo Scenario Shortcut Bar */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-950 border border-blue-500/30 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="p-1.5 bg-blue-600/30 text-blue-400 rounded-md font-bold">
              <Zap size={14} />
            </span>
            <div>
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                Hackathon Presentation Quick Triggers:
              </span>
              <p className="text-slate-400 text-[11px]">
                Test context-aware access decision logic live in 1 click
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runDemoScenario1}
              className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/40 rounded-lg text-xs font-semibold text-red-200 transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert size={13} className="text-red-400" />
              Scenario 1: Akash G (Staff) → BLOCKED
            </button>

            <button
              onClick={runDemoScenario2}
              className="px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/40 rounded-lg text-xs font-semibold text-emerald-200 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck size={13} className="text-emerald-400" />
              Scenario 2: Dr. Priya Sharma → ALLOWED
            </button>
          </div>
        </div>

        {/* 4 Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Protected Documents"
            value={stats.protectedDocuments || 12}
            subtitle="SHA-256 Crypto Sealed"
            icon={FileText}
            color="blue"
            linkTo="/documents"
          />

          <StatCard
            title="Active Policies"
            value={stats.activePolicies || 8}
            subtitle="Role & Time Enforced"
            icon={Lock}
            color="green"
            linkTo="/policies"
          />

          <StatCard
            title="Blocked Attempts"
            value={stats.blockedAttempts || 7}
            subtitle="Policy Access Denied"
            icon={ShieldAlert}
            color="red"
            linkTo="/audit"
          />

          <StatCard
            title="Security Alerts"
            value={stats.activeAlerts || 2}
            subtitle="Require Review"
            icon={Activity}
            color="amber"
            linkTo="/security"
          />
        </div>

        {/* System Integrity & Health Bar */}
        <div className="vault-card p-5 border border-cyan-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">System Document Integrity</h3>
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">
                    {stats.integrityPercentage || "98.7%"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  All active examination documents verified against recorded SHA-256 hash digests.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/documents')}
                className="vault-btn vault-btn-outline text-xs"
              >
                Inspect Vault
              </button>
            </div>
          </div>
        </div>

        {/* Grid Section: Recent Security Activity & Live Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table: Recent Audit Activity (2 Columns wide) */}
          <div className="lg:col-span-2 vault-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Recent Security Activity</h3>
                <p className="text-xs text-slate-400">Live access requests evaluated by ExamVault</p>
              </div>
              <button
                onClick={() => navigate('/audit')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <span>View Full Audit Log</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="vault-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Document</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="font-semibold text-white">{log.user}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.userRole}</div>
                      </td>
                      <td className="font-mono text-xs font-bold text-cyan-400">
                        {log.action}
                      </td>
                      <td className="max-w-[180px] truncate text-slate-300" title={log.document}>
                        {log.document}
                      </td>
                      <td className="text-xs text-slate-400 font-mono">
                        {log.timestamp ? log.timestamp.split(' ')[1] || log.timestamp : '10:15'}
                      </td>
                      <td>
                        <StatusBadge status={log.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Security Threats Widget (1 Column) */}
          <div className="vault-card p-5 border border-red-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle size={18} />
                Active Security Alerts
              </div>
              <button
                onClick={() => navigate('/security')}
                className="text-[11px] font-bold text-slate-400 hover:text-white"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {securityEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => navigate('/security')}
                  className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 hover:border-red-500/40 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <StatusBadge status={evt.severity} />
                    <span className="text-[10px] text-slate-500 font-mono">{evt.timestamp}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-200">{evt.type}</div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{evt.message}</p>
                  <div className="text-[10px] text-cyan-400 font-mono pt-1 border-t border-slate-900">
                    Target: {evt.document}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onAccessDecision={fetchDashboardData}
      />
    </div>
  );
};

export default Dashboard;
