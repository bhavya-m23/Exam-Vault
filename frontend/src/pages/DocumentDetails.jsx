import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import RequestAccessModal from '../components/RequestAccessModal';
import { 
  FileText, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Lock, 
  Zap, 
  ArrowLeft,
  Activity,
  Flame,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DocumentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, showToast } = useAuth();

  const [document, setDocument] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [integrityState, setIntegrityState] = useState(null);

  const fetchDocumentDetails = async () => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocument(data.document);
        setPolicy(data.policy);
        setAuditTrail(data.auditTrail || []);
      } else {
        showToast('Document not found', 'danger');
      }
    } catch (err) {
      showToast('Error loading document details', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentDetails();
  }, [id]);

  const handleVerifyIntegrity = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser ? currentUser.name : "System Auditor",
          userRole: currentUser ? currentUser.role : "Administrator"
        })
      });
      const data = await res.json();
      setIntegrityState(data);

      if (data.verified) {
        showToast('✓ INTEGRITY VERIFIED: Recorded SHA-256 fingerprint matches current fingerprint.', 'success');
      } else {
        showToast('⚠ INTEGRITY WARNING: Document fingerprint mismatch detected!', 'danger');
      }
      fetchDocumentDetails();
    } catch (err) {
      showToast('Error verifying fingerprint integrity', 'danger');
    }
  };

  const handleSimulateTampering = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/tamper`, { method: 'POST' });
      const data = await res.json();
      showToast('⚠ TAMPERING SIMULATED: Payload modified! Integrity warning generated.', 'danger');
      fetchDocumentDetails();
    } catch (err) {
      showToast('Error simulating tampering', 'danger');
    }
  };

  const handleRestoreDocument = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: currentUser ? currentUser.name : "Administrator"
        })
      });
      const data = await res.json();
      showToast('✓ Document restored to pristine verified state.', 'success');
      setIntegrityState(null);
      fetchDocumentDetails();
    } catch (err) {
      showToast('Error restoring document', 'danger');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center text-slate-400">
        Loading document details...
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex-1 p-8 text-center">
        <h3 className="text-lg font-bold text-white">Document Not Found</h3>
        <button onClick={() => navigate('/documents')} className="vault-btn vault-btn-primary mt-4">
          Return to Documents Vault
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 pb-12">
      <Header
        title={`Document Details — ${document.id}`}
        subtitle={document.name}
        onOpenRequestModal={() => setIsRequestModalOpen(true)}
      />

      <main className="p-6 space-y-6">
        {/* Back Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/documents')}
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Documents Vault
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="vault-btn vault-btn-primary text-xs"
            >
              <Zap size={14} className="text-amber-300 fill-amber-300/20" />
              Request Access
            </button>
          </div>
        </div>

        {/* Top Split Layout: Metadata + Fingerprint Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metadata Card (2 Columns) */}
          <div className="lg:col-span-2 vault-card p-6 border border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <FileText size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">{document.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Subject: <span className="text-slate-200 font-semibold">{document.subject}</span>
                  </p>
                </div>
              </div>
              <StatusBadge status={document.isTampered ? 'INTEGRITY_COMPROMISED' : document.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-800/80 text-xs">
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Document ID</span>
                <span className="font-mono font-bold text-white">{document.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Owner</span>
                <span className="font-semibold text-slate-200">{document.owner}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Sensitivity</span>
                <StatusBadge status={document.sensitivity} />
              </div>
              <div>
                <span className="text-slate-500 block uppercase font-bold text-[10px]">Version</span>
                <span className="font-mono font-bold text-cyan-400">v{document.version}</span>
              </div>
            </div>

            {/* Document Preview Snippet */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center justify-between">
                <span>Encrypted Content Payload Digest:</span>
                <span>Size: {document.fileSize || '2.4 MB'}</span>
              </div>
              <p className="leading-relaxed text-slate-300">{document.content}</p>
            </div>
          </div>

          {/* SHA-256 Fingerprint & Verification Card (1 Column) */}
          <div className={`vault-card p-6 border ${document.isTampered ? 'border-red-500/50 vault-glow-red' : 'border-cyan-500/30'} flex flex-col justify-between space-y-4`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound size={16} className={document.isTampered ? 'text-red-400' : 'text-cyan-400'} />
                  Integrity Fingerprint
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  SHA-256
                </span>
              </div>

              {/* Fingerprint Digest Display */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] break-all leading-normal">
                <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">
                  Recorded SHA-256 Digest:
                </span>
                <span className="text-cyan-400 font-bold">{document.originalFingerprint}</span>
              </div>

              {/* Integrity Warning Banner if Tampered */}
              {document.isTampered && (
                <div className="mt-3 p-3 bg-red-950/80 border border-red-500/50 rounded-lg text-xs text-red-200 space-y-1 animate-pulse">
                  <div className="font-extrabold flex items-center gap-1.5 text-red-400">
                    <AlertTriangle size={15} />
                    ⚠ INTEGRITY WARNING
                  </div>
                  <p className="text-[11px]">
                    Document fingerprint does not match the recorded version.
                  </p>
                  <div className="text-[10px] font-mono text-red-300 break-all pt-1 border-t border-red-900">
                    Current: {document.fingerprint}
                  </div>
                </div>
              )}
            </div>

            {/* Verification & Hackathon Simulation Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleVerifyIntegrity}
                className="vault-btn vault-btn-success w-full text-xs"
              >
                <CheckCircle2 size={15} />
                Verify Integrity
              </button>

              {!document.isTampered ? (
                <button
                  onClick={handleSimulateTampering}
                  className="vault-btn vault-btn-danger w-full text-xs"
                  title="Hackathon Demo: Simulate unauthorized content modification"
                >
                  <Flame size={15} />
                  Simulate Tampering
                </button>
              ) : (
                <button
                  onClick={handleRestoreDocument}
                  className="vault-btn vault-btn-secondary w-full text-xs"
                >
                  <RotateCcw size={15} />
                  Restore Document
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Associated Access Policy & Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Access Policy Details */}
          <div className="vault-card p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock size={18} className="text-cyan-400" />
                Active Access Policy
              </h3>
              {policy && <StatusBadge status={policy.status} />}
            </div>

            {policy ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 block uppercase font-bold text-[10px]">Allowed Roles</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {policy.allowedRoles.map(role => (
                      <span key={role} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-semibold border border-blue-500/20">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-bold text-[10px]">Allowed Actions</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {policy.allowedActions.map(act => (
                      <span key={act} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold border border-cyan-500/20">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
                  <div>
                    <span className="text-slate-500 block uppercase font-bold text-[10px]">Purpose</span>
                    <span className="font-semibold text-slate-200">{policy.purpose}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-bold text-[10px]">Access Window</span>
                    <span className="font-mono text-cyan-400 font-bold">{policy.startTime} - {policy.endTime}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No active policy configured for this document.</p>
            )}
          </div>

          {/* Document Audit Trail (2 Columns) */}
          <div className="lg:col-span-2 vault-card p-6 border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Activity size={18} className="text-blue-400" />
              Document Access Trail
            </h3>

            <div className="overflow-x-auto">
              <table className="vault-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.length > 0 ? (
                    auditTrail.map((log) => (
                      <tr key={log.id}>
                        <td className="font-mono text-xs text-slate-400">{log.timestamp}</td>
                        <td>
                          <div className="font-semibold text-white">{log.user}</div>
                          <div className="text-[10px] text-slate-400">{log.userRole}</div>
                        </td>
                        <td className="font-mono text-xs font-bold text-cyan-400">{log.action}</td>
                        <td><StatusBadge status={log.result} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-500 text-xs">
                        No audit events recorded for this document yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <RequestAccessModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        document={document}
      />
    </div>
  );
};

export default DocumentDetails;
