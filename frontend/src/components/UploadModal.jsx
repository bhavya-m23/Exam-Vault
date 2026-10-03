import React, { useState } from 'react';
import { X, Upload, ShieldCheck, FileText, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UploadModal = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser, showToast } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    sensitivity: 'High',
    content: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.subject) {
      showToast('Please provide Document Name and Subject', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          owner: currentUser ? currentUser.name : "Dr. Priya Sharma",
          ownerRole: currentUser ? currentUser.role : "Exam Coordinator"
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Document secured successfully. SHA-256 fingerprint generated: ${data.document.fingerprint.substring(0, 10)}...`, 'success');
        onSuccess && onSuccess(data.document);
        onClose();
        setFormData({ name: '', subject: '', sensitivity: 'High', content: '' });
      } else {
        showToast(data.message || 'Failed to upload document', 'danger');
      }
    } catch (err) {
      showToast('Backend connection error', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="vault-card w-full max-w-lg overflow-hidden border border-blue-500/30 vault-glow-blue animate-in fade-in zoom-in duration-150">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-base">
            <Upload size={18} />
            Secure Document Upload
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Document Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Systems - Final Exam.pdf"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="vault-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Subject / Course *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Computer Science"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="vault-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Sensitivity Level
              </label>
              <select
                value={formData.sensitivity}
                onChange={(e) => setFormData({ ...formData, sensitivity: e.target.value })}
                className="vault-input cursor-pointer"
              >
                <option value="Critical">Critical (Highest Restricted)</option>
                <option value="High">High Confidential</option>
                <option value="Medium">Medium Evaluation</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Document Payload / Content Simulation
            </label>
            <textarea
              rows={3}
              placeholder="Enter exam question text or mock contents to generate SHA-256 fingerprint..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="vault-input resize-none"
            />
          </div>

          {/* SHA-256 Info Box */}
          <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2.5">
            <KeyRound size={16} className="text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-cyan-300">Automated SHA-256 Cryptographic Sealing:</span>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Upon submission, Node.js <code className="text-cyan-300 font-mono">crypto</code> will generate an immutable digest fingerprint and initialize an active access policy.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="vault-btn vault-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="vault-btn vault-btn-primary">
              {loading ? 'Securing Document...' : 'Secure & Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
