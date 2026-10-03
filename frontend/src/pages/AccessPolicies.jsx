import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import CreatePolicyModal from '../components/CreatePolicyModal';
import RequestAccessModal from '../components/RequestAccessModal';
import { Lock, Plus, FileText, Clock, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AccessPolicies = () => {
  const { showToast } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [polRes, docRes] = await Promise.all([
        fetch('/api/policies'),
        fetch('/api/documents')
      ]);

      if (polRes.ok) {
        const polData = await polRes.json();
        setPolicies(polData);
      }
      if (docRes.ok) {
        const docData = await docRes.json();
        setDocuments(docData);
      }
    } catch (err) {
      showToast('Error loading policies', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex-1 min-w-0 pb-12">
      <Header
        title="Access Policies"
        subtitle="Configure role, action, purpose, and time-based rules"
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Active Access Policies</h2>
            <p className="text-xs text-slate-400">Total {policies.length} security rules active</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="vault-btn vault-btn-outline text-xs"
            >
              <Zap size={14} className="text-amber-400 fill-amber-400/20" />
              Test Access Engine
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="vault-btn vault-btn-primary text-xs"
            >
              <Plus size={16} />
              Create Policy
            </button>
          </div>
        </div>

        {/* Policy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {policies.map((pol) => (
            <div key={pol.id} className="vault-card p-5 border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                    {pol.id}
                  </span>
                  <StatusBadge status={pol.status} />
                </div>

                <h3 className="font-bold text-white text-sm line-clamp-1 flex items-center gap-1.5 mt-2" title={pol.documentName}>
                  <FileText size={16} className="text-blue-400 shrink-0" />
                  {pol.documentName}
                </h3>
              </div>

              <div className="space-y-3 text-xs border-t border-b border-slate-800/80 py-3">
                <div>
                  <span className="text-slate-500 block uppercase font-bold text-[10px] mb-1">
                    Allowed Roles
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pol.allowedRoles.map((role) => (
                      <span key={role} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-bold text-[10px] mb-1">
                    Permitted Actions
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pol.allowedActions.map((act) => (
                      <span key={act} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold border border-cyan-500/20">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-slate-500 block font-bold text-[10px]">Purpose</span>
                    <span className="font-semibold text-slate-200">{pol.purpose}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-bold text-[10px]">Access Window</span>
                    <span className="font-mono text-cyan-400 font-bold flex items-center gap-1">
                      <Clock size={12} />
                      {pol.startTime} - {pol.endTime}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono flex justify-between items-center">
                <span>Target ID: {pol.documentId}</span>
                <span>Active Protection</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <CreatePolicyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        documents={documents}
        onSuccess={fetchData}
      />

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        documents={documents}
      />
    </div>
  );
};

export default AccessPolicies;
