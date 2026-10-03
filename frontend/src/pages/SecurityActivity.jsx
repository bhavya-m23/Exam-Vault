import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import RequestAccessModal from '../components/RequestAccessModal';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCheck, 
  Flame, 
  Clock, 
  UserX, 
  FileX,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SecurityActivity = () => {
  const { currentUser, showToast } = useAuth();
  const [securityEvents, setSecurityEvents] = useState([]);
  const [stats, setStats] = useState({
    activeAlerts: 2,
    blockedAttempts: 7,
    integrityWarnings: 1
  });
  const [loading, setLoading] = useState(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const fetchSecurityData = async () => {
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch('/api/security/events'),
        fetch('/api/security/stats')
      ]);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setSecurityEvents(eventsData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      showToast('Error loading security activity', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleMarkAsReviewed = async (eventId) => {
    try {
      const res = await fetch(`/api/security/events/${eventId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser ? currentUser.name : "Administrator",
          status: "Reviewed"
        })
      });

      if (res.ok) {
        showToast(`Security alert ${eventId} marked as Reviewed.`, 'success');
        fetchSecurityData();
      }
    } catch (err) {
      showToast('Error updating security alert', 'danger');
    }
  };

  return (
    <div className="flex-1 min-w-0 pb-12">
      <Header
        title="Security Activity"
        subtitle="Cyberthreat monitoring and intrusion detection feed"
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Threat Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Threat Alerts"
            value={stats.activeAlerts || 2}
            subtitle="Immediate Action Required"
            icon={ShieldAlert}
            color="red"
          />

          <StatCard
            title="Blocked Attempts"
            value={stats.blockedAttempts || 7}
            subtitle="Enforced by Access Rules"
            icon={UserX}
            color="amber"
          />

          <StatCard
            title="Integrity Warnings"
            value={stats.integrityWarnings || 1}
            subtitle="Fingerprint Mismatch Alerts"
            icon={Flame}
            color="red"
          />
        </div>

        {/* Security Events Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-400" />
              Security Event Timeline
            </h2>

            <span className="text-xs text-slate-400 font-mono">
              Real-time Intrusion Detection Engine
            </span>
          </div>

          <div className="space-y-4">
            {securityEvents.map((evt) => {
              const isCritical = evt.severity === 'CRITICAL' || evt.severity === 'HIGH';

              return (
                <div
                  key={evt.id}
                  className={`vault-card p-5 border ${
                    isCritical 
                      ? 'border-red-500/40 bg-gradient-to-r from-red-950/20 via-slate-900 to-slate-950' 
                      : 'border-slate-800'
                  } transition-all`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={evt.severity} />
                        <span className="font-mono text-xs font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {evt.id}
                        </span>
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wide">
                          {evt.type}
                        </span>
                        <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                          <Clock size={12} />
                          {evt.timestamp}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                        {evt.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium">
                        <span>
                          User: <strong className="text-white">{evt.user || 'Unknown'}</strong> ({evt.userRole || 'Staff'})
                        </span>
                        <span>•</span>
                        <span>
                          Target File: <strong className="text-cyan-400">{evt.document}</strong>
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px] text-slate-500">IP: {evt.ip || '192.168.1.45'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {evt.status === 'Active' ? (
                        <button
                          onClick={() => handleMarkAsReviewed(evt.id)}
                          className="vault-btn vault-btn-outline text-xs px-3 py-2 flex items-center gap-1.5"
                        >
                          <CheckCheck size={15} />
                          Mark as Reviewed
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                          <ShieldCheck size={14} />
                          Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
      />
    </div>
  );
};

export default SecurityActivity;
