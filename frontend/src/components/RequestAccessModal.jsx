import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Zap, UserCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RequestAccessModal = ({ isOpen, onClose, document, documents = [], onAccessDecision }) => {
  const { currentUser, users, showToast } = useAuth();
  
  const [selectedDocId, setSelectedDocId] = useState(document ? document.id : (documents[0] ? documents[0].id : 'DOC-001'));
  const [selectedUserId, setSelectedUserId] = useState(currentUser ? currentUser.id : 'USR-003');
  const [action, setAction] = useState('VIEW');
  const [purpose, setPurpose] = useState('Exam Preparation');

  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const targetDoc = document || documents.find(d => d.id === selectedDocId) || { name: 'Exam Document', id: selectedDocId };
  const targetUser = users.find(u => u.id === selectedUserId) || currentUser || { name: 'User', role: 'Staff' };

  const handleCheckAccess = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDecision(null);

    try {
      const res = await fetch('/api/access/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          documentId: targetDoc.id,
          action,
          purpose
        })
      });

      const data = await res.json();
      setDecision(data);

      if (data.allowed) {
        showToast(`ACCESS GRANTED for ${targetUser.name} (${targetUser.role})`, 'success');
      } else {
        showToast(`ACCESS BLOCKED: ${data.reason}`, 'danger');
      }

      if (onAccessDecision) {
        onAccessDecision(data);
      }
    } catch (err) {
      showToast('Error communicating with verification engine', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="vault-card w-full max-w-lg overflow-hidden border border-blue-500/40 vault-glow-blue animate-in fade-in zoom-in duration-150">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-base">
            <Zap size={18} className="text-amber-400 fill-amber-400/20" />
            Request Document Access
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCheckAccess} className="p-6 space-y-4">
          {/* User Selection (For Hackathon Demo Switch) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center justify-between">
              <span>Requesting User Context</span>
              <span className="text-[10px] text-cyan-400 font-mono">Role: {targetUser.role}</span>
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setDecision(null);
              }}
              className="vault-input cursor-pointer font-medium text-white"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — Role: {u.role} ({u.department})
                </option>
              ))}
            </select>
          </div>

          {/* Document Selector if not pre-bound */}
          {!document && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Target Examination Document
              </label>
              <select
                value={selectedDocId}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  setDecision(null);
                }}
                className="vault-input cursor-pointer"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.id}] {d.name} — Sensitivity: {d.sensitivity}
                  </option>
                ))}
              </select>
            </div>
          )}

          {document && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="text-slate-400">Target Document:</div>
              <div className="font-bold text-slate-200">{document.name}</div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Subject: {document.subject}</span>
                <span>•</span>
                <span className="text-amber-400 font-bold">Sensitivity: {document.sensitivity}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Requested Action
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="vault-input font-mono font-bold cursor-pointer"
              >
                <option value="VIEW">VIEW</option>
                <option value="DOWNLOAD">DOWNLOAD</option>
                <option value="EDIT">EDIT</option>
                <option value="SHARE">SHARE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Declared Purpose
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="vault-input cursor-pointer"
              >
                <option value="Exam Preparation">Exam Preparation</option>
                <option value="Internal Review">Internal Review</option>
                <option value="Evaluation">Evaluation</option>
                <option value="Personal Study">Personal Study (Unapproved)</option>
              </select>
            </div>
          </div>

          {/* Decision Outcome Display */}
          {decision && (
            <div className={`p-4 rounded-xl border animate-in fade-in duration-200 ${
              decision.allowed 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {decision.allowed ? (
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={24} className="text-red-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-extrabold text-sm uppercase tracking-wide">
                    {decision.allowed ? '✓ ACCESS GRANTED' : '✕ ACCESS BLOCKED'}
                  </h4>
                  <p className="text-xs font-medium mt-1 leading-relaxed text-slate-200">
                    {decision.reason}
                  </p>

                  <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center gap-2">
                    <span>Audit Log generated</span>
                    <span>•</span>
                    <span>Security Engine Evaluated</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="vault-btn vault-btn-secondary">
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="vault-btn vault-btn-primary"
            >
              {loading ? 'Evaluating Policy...' : 'Check Access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestAccessModal;
